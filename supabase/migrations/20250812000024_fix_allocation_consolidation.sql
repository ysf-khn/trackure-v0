-- Fix allocate_item_to_workflow to consolidate with existing allocations
-- This prevents duplicate allocation records for the same item+stage combination

CREATE OR REPLACE FUNCTION public.allocate_item_to_workflow(
    p_item_id uuid,
    p_stage_id uuid,
    p_quantity integer,
    p_allocated_by uuid
)
RETURNS void AS $$
DECLARE
    v_org_id uuid;
    v_item_working_quantity integer;
    v_item_allocated_quantity integer;
    v_item_status text;
    v_available_to_allocate integer;
    v_existing_allocation_id uuid;
    v_existing_quantity integer;
BEGIN
    -- Input validation
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity to allocate must be positive. Received: %', p_quantity;
    END IF;

    -- Lock the items row first to prevent concurrent modifications
    SELECT organization_id, working_quantity, allocated_quantity, status
    INTO v_org_id, v_item_working_quantity, v_item_allocated_quantity, v_item_status
    FROM public.items
    WHERE id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with ID % not found.', p_item_id;
    END IF;

    -- Calculate available quantity using allocated_quantity column
    v_available_to_allocate := v_item_working_quantity - v_item_allocated_quantity;

    -- Validate requested quantity
    IF p_quantity > v_available_to_allocate THEN
        RAISE EXCEPTION 'Requested quantity (%) exceeds available unallocated quantity (%). Item: %', 
            p_quantity, v_available_to_allocate, p_item_id;
    END IF;

    -- Additional safety check: don't allocate from scrapped items
    IF EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id AND COALESCE(is_scrapped, false) = true) THEN
        RAISE EXCEPTION 'Cannot allocate from scrapped item %', p_item_id;
    END IF;

    -- Check for existing allocation for this item+stage combination
    SELECT id, quantity INTO v_existing_allocation_id, v_existing_quantity
    FROM public.item_stage_allocations
    WHERE item_id = p_item_id 
      AND stage_id = p_stage_id
      AND status = 'In Progress'  -- Only consolidate with active allocations
    FOR UPDATE;

    IF v_existing_allocation_id IS NOT NULL THEN
        -- Update existing allocation by adding the new quantity
        UPDATE public.item_stage_allocations
        SET 
            quantity = quantity + p_quantity,
            updated_at = NOW(),
            moved_by = p_allocated_by  -- Update moved_by to reflect latest allocation
        WHERE id = v_existing_allocation_id;
        
        -- Record the consolidation in movement history
        INSERT INTO public.item_movement_history (
            item_id, from_stage_id, to_stage_id, 
            quantity, moved_by, organization_id
        ) VALUES (
            p_item_id, null, p_stage_id, 
            p_quantity, p_allocated_by, v_org_id
        );
        
    ELSE
        -- No existing allocation - create new one
        INSERT INTO public.item_stage_allocations (
            item_id, stage_id, quantity, status, moved_by, organization_id
        ) VALUES (
            p_item_id, p_stage_id, p_quantity, 'In Progress', p_allocated_by, v_org_id
        );

        -- Record the movement
        INSERT INTO public.item_movement_history (
            item_id, from_stage_id, to_stage_id, 
            quantity, moved_by, organization_id
        ) VALUES (
            p_item_id, null, p_stage_id, 
            p_quantity, p_allocated_by, v_org_id
        );
    END IF;

    -- DON'T manually update allocated_quantity - the trigger handles this automatically
    
    -- Update item status logic - be smarter about status transitions
    IF v_item_status = 'New' AND (v_item_allocated_quantity + p_quantity) = v_item_working_quantity THEN
        -- Only change from 'New' to 'In Workflow' if fully allocated
        UPDATE public.items
        SET status = 'In Workflow'
        WHERE id = p_item_id;
    ELSIF v_item_status = 'New' AND (v_item_allocated_quantity + p_quantity) < v_item_working_quantity THEN
        -- Partial allocation from New - keep status as 'New'
        -- No status change needed
        NULL;
    ELSE
        -- Item is already 'In Workflow' or other status - don't change status
        -- This handles the case where we're allocating replacement quantities
        NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION public.allocate_item_to_workflow(uuid, uuid, integer, uuid) IS 'Allocates unallocated quantity to workflow stage. Consolidates with existing allocations for the same item+stage combination to avoid duplicate allocation records. Works with items of any status as long as they have available unallocated quantity.';