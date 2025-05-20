-- Migration: Fix Allocation Locking
-- Purpose: Fix the FOR UPDATE issue with aggregate functions in allocation logic

-- Drop and recreate the allocation function with fixed locking logic
CREATE OR REPLACE FUNCTION public.allocate_item_to_workflow(
    p_item_id uuid,
    p_stage_id uuid,
    p_sub_stage_id uuid,
    p_quantity integer,
    p_allocated_by uuid
)
RETURNS void AS $$
DECLARE
    v_org_id uuid;
    v_item_original_total_quantity integer;
    v_item_status text;
    v_currently_allocated_in_stages integer;
    v_available_to_allocate_from_new integer;
BEGIN
    -- Input validation
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity to allocate must be positive. Received: %', p_quantity;
    END IF;

    -- Lock the items row first to prevent concurrent modifications
    SELECT organization_id, total_quantity, status
    INTO v_org_id, v_item_original_total_quantity, v_item_status
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

    -- Lock all existing allocations for this item to prevent concurrent modifications
    -- Note: This is a no-op if no allocations exist, but ensures proper locking if they do
    PERFORM 1 
    FROM public.item_stage_allocations 
    WHERE item_id = p_item_id 
    FOR UPDATE;

    -- Now calculate current allocations (after acquiring locks)
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_currently_allocated_in_stages
    FROM public.item_stage_allocations
    WHERE item_id = p_item_id;

    -- Calculate available quantity
    v_available_to_allocate_from_new := v_item_original_total_quantity - v_currently_allocated_in_stages;

    -- Validate requested quantity
    IF p_quantity > v_available_to_allocate_from_new THEN
        RAISE EXCEPTION 'Requested quantity (%) exceeds available quantity in New pool (%). Item: %', 
            p_quantity, v_available_to_allocate_from_new, p_item_id;
    END IF;

    -- Create the allocation record
    INSERT INTO public.item_stage_allocations (
        item_id, stage_id, sub_stage_id, quantity, status, moved_by, organization_id
    ) VALUES (
        p_item_id, p_stage_id, p_sub_stage_id, p_quantity, 'In Progress', p_allocated_by, v_org_id
    );

    -- Record the movement
    INSERT INTO public.item_movement_history (
        item_id, from_stage_id, from_sub_stage_id, to_stage_id, to_sub_stage_id, 
        quantity, moved_by, organization_id
    ) VALUES (
        p_item_id, null, null, p_stage_id, p_sub_stage_id, 
        p_quantity, p_allocated_by, v_org_id
    );

    -- Update item status if fully allocated
    IF (v_currently_allocated_in_stages + p_quantity) = v_item_original_total_quantity THEN
        UPDATE public.items
        SET status = 'In Workflow'
        WHERE id = p_item_id;
    END IF;
END;
$$ LANGUAGE plpgsql; 