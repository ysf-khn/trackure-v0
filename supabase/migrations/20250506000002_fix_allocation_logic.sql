-- Migration: Fix Allocation Logic
-- Purpose: Fix issues with item allocation and status tracking
-- Changes:
--   1. Add trigger to validate total_quantity never changes
--   2. Add trigger to ensure allocation quantities are valid
--   3. Recreate the allocation function with fixed logic

-- First, create a trigger to ensure total_quantity never changes after insert
CREATE OR REPLACE FUNCTION public.prevent_total_quantity_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.total_quantity != OLD.total_quantity THEN
        RAISE EXCEPTION 'Cannot modify total_quantity after item creation. Original: %, Attempted: %', 
            OLD.total_quantity, NEW.total_quantity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_total_quantity_modification ON public.items;
CREATE TRIGGER prevent_total_quantity_modification
    BEFORE UPDATE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_total_quantity_change();

-- Recreate the allocation validation trigger with better error messages
CREATE OR REPLACE FUNCTION public.validate_allocation_quantity()
RETURNS TRIGGER AS $$
DECLARE
    total_allocated integer;
    item_total integer;
BEGIN
    -- Calculate total allocated quantity for this item (including the new/updated allocation)
    SELECT COALESCE(SUM(quantity), 0) INTO total_allocated
    FROM public.item_stage_allocations
    WHERE item_id = NEW.item_id
    AND id != NEW.id; -- Exclude this allocation if it's an update
    
    total_allocated := total_allocated + NEW.quantity;
    
    -- Get the item's total quantity
    SELECT total_quantity INTO item_total
    FROM public.items
    WHERE id = NEW.item_id;
    
    -- Ensure allocated quantity doesn't exceed total
    IF total_allocated > item_total THEN
        RAISE EXCEPTION 'Total allocated quantity (%) would exceed item total quantity (%). Item ID: %', 
            total_allocated, item_total, NEW.item_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to ensure clean state
DROP TRIGGER IF EXISTS check_allocation_quantity ON public.item_stage_allocations;
CREATE TRIGGER check_allocation_quantity
    BEFORE INSERT OR UPDATE ON public.item_stage_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_allocation_quantity();

-- Drop and recreate the view to ensure it's using the latest logic
DROP VIEW IF EXISTS public.new_order_items;
CREATE OR REPLACE VIEW public.new_order_items AS
SELECT 
    i.id AS item_id,
    i.sku,
    i.buyer_id,
    i.total_quantity AS original_item_total_quantity,
    (i.total_quantity - COALESCE(sa.allocated_sum, 0)) AS quantity_in_new_pool,
    i.remaining_quantity,
    o.id AS order_id,
    o.order_number,
    o.customer_name,
    i.created_at,
    i.organization_id,
    i.status
FROM 
    public.items i
JOIN 
    public.orders o ON i.order_id = o.id
LEFT JOIN (
    SELECT 
        item_id, 
        SUM(quantity) AS allocated_sum
    FROM public.item_stage_allocations
    GROUP BY item_id
) sa ON i.id = sa.item_id
WHERE 
    i.status = 'New' 
    AND (i.total_quantity - COALESCE(sa.allocated_sum, 0)) > 0;

-- Drop and recreate the allocation function with fixed logic
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

    -- Calculate current allocations with row-level locking
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_currently_allocated_in_stages
    FROM public.item_stage_allocations
    WHERE item_id = p_item_id
    FOR UPDATE;

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

-- Ensure execute permission is granted
GRANT EXECUTE ON FUNCTION public.allocate_item_to_workflow(uuid, uuid, uuid, integer, uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.allocate_item_to_workflow IS 'Allocates a quantity of an item from New status to a workflow stage/sub-stage.';
COMMENT ON TRIGGER prevent_total_quantity_modification ON public.items IS 'Ensures total_quantity cannot be modified after item creation.';
COMMENT ON TRIGGER check_allocation_quantity ON public.item_stage_allocations IS 'Validates that allocated quantities do not exceed item total_quantity.'; 