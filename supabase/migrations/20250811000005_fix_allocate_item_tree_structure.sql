-- Update allocate_item_to_workflow to work with tree structure (no sub_stage_id)
-- The tree structure uses only stage_id, not sub_stage_id

CREATE OR REPLACE FUNCTION public.allocate_item_to_workflow(
    p_item_id uuid,
    p_stage_id uuid,
    p_sub_stage_id uuid, -- Keep parameter for compatibility but ignore it
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
    v_item_sku text;
BEGIN
    -- Input validation
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity to allocate must be positive. Received: %', p_quantity;
    END IF;
    
    -- Lock the items row first to prevent concurrent modifications
    SELECT 
        organization_id, 
        total_quantity, 
        status,
        sku
    INTO 
        v_org_id, 
        v_item_original_total_quantity, 
        v_item_status,
        v_item_sku
    FROM items 
    WHERE id = p_item_id 
    FOR UPDATE;
    
    -- Validate that the item exists
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Item with ID % not found', p_item_id;
    END IF;
    
    -- Validate that the target stage exists and belongs to the same organization
    IF NOT EXISTS (
        SELECT 1 FROM workflow_stages 
        WHERE id = p_stage_id 
        AND organization_id = v_org_id
        AND (sku IS NULL OR sku = v_item_sku) -- Allow org-wide or SKU-specific stages
    ) THEN
        RAISE EXCEPTION 'Target stage % not found or does not belong to the same organization/SKU', p_stage_id;
    END IF;
    
    -- Calculate currently allocated quantity across all stages
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_currently_allocated_in_stages
    FROM item_stage_allocations
    WHERE item_id = p_item_id
    AND status = 'active';
    
    -- Calculate available quantity to allocate from 'New' status
    v_available_to_allocate_from_new := v_item_original_total_quantity - v_currently_allocated_in_stages;
    
    -- Validate that there's enough quantity available
    IF p_quantity > v_available_to_allocate_from_new THEN
        RAISE EXCEPTION 'Insufficient quantity available. Requested: %, Available: %', 
            p_quantity, v_available_to_allocate_from_new;
    END IF;
    
    -- Insert allocation record (no sub_stage_id in tree structure)
    INSERT INTO item_stage_allocations (
        item_id,
        stage_id,
        quantity,
        status,
        moved_by,
        organization_id,
        created_at,
        updated_at
    ) VALUES (
        p_item_id,
        p_stage_id,
        p_quantity,
        'active',
        p_allocated_by,
        v_org_id,
        NOW(),
        NOW()
    );
    
    -- Update item status to 'In Workflow' if it was 'New'
    IF v_item_status = 'New' THEN
        UPDATE items 
        SET 
            status = 'In Workflow',
            updated_at = NOW()
        WHERE id = p_item_id;
    END IF;
    
    -- Record the movement in history
    INSERT INTO item_movement_history (
        item_id,
        from_stage_id,
        to_stage_id,
        quantity,
        moved_by,
        organization_id,
        moved_at
    ) VALUES (
        p_item_id,
        NULL, -- From "New" status, no previous stage
        p_stage_id,
        p_quantity,
        p_allocated_by,
        v_org_id,
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.allocate_item_to_workflow(uuid, uuid, uuid, integer, uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.allocate_item_to_workflow IS 
'Updated for tree structure: Allocates items to workflow stages without using sub_stage_id. 
The p_sub_stage_id parameter is kept for compatibility but ignored.';