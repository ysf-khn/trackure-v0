-- Fix double increment of allocated_quantity
-- The triggers automatically update allocated_quantity, so we shouldn't do it manually in the function

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

    -- Verify item is in 'New' status
    IF v_item_status <> 'New' THEN
        RAISE EXCEPTION 'Item % is not in New status. Current status: %', p_item_id, v_item_status;
    END IF;

    -- Calculate available quantity using allocated_quantity column
    v_available_to_allocate := v_item_working_quantity - v_item_allocated_quantity;

    -- Validate requested quantity
    IF p_quantity > v_available_to_allocate THEN
        RAISE EXCEPTION 'Requested quantity (%) exceeds available quantity in New pool (%). Item: %', 
            p_quantity, v_available_to_allocate, p_item_id;
    END IF;

    -- Create the allocation record (no sub_stage_id in tree structure)
    -- The trigger will automatically update allocated_quantity, so we don't do it manually
    INSERT INTO public.item_stage_allocations (
        item_id, stage_id, quantity, status, moved_by, organization_id
    ) VALUES (
        p_item_id, p_stage_id, p_quantity, 'In Progress', p_allocated_by, v_org_id
    );

    -- DON'T manually update allocated_quantity - the trigger handles this automatically
    
    -- Record the movement (no sub_stage_id in tree structure)
    INSERT INTO public.item_movement_history (
        item_id, from_stage_id, to_stage_id, 
        quantity, moved_by, organization_id
    ) VALUES (
        p_item_id, null, p_stage_id, 
        p_quantity, p_allocated_by, v_org_id
    );

    -- Update item status if fully allocated (compare against working_quantity)
    IF (v_item_allocated_quantity + p_quantity) = v_item_working_quantity THEN
        UPDATE public.items
        SET status = 'In Workflow'
        WHERE id = p_item_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION public.allocate_item_to_workflow(uuid, uuid, integer, uuid) IS 'Allocates a quantity of an item from New status to a workflow stage. Uses database triggers to automatically maintain allocated_quantity column.';