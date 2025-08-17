-- Remove allocation type prioritization from movement logic
-- This migration documents the change - the actual logic updates happen in API routes

-- Create a simplified move function that respects user choice without prioritization
CREATE OR REPLACE FUNCTION move_items_simple(
    p_item_id UUID,
    p_from_stage_id UUID, 
    p_to_stage_id UUID,
    p_quantity INTEGER,
    p_allocation_id UUID, -- User specifies exact allocation to move from
    p_user_id UUID,
    p_organization_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_source_allocation RECORD;
    v_target_allocation RECORD;
    v_timestamp TIMESTAMPTZ := NOW();
BEGIN
    -- Get the specific source allocation the user selected
    SELECT * INTO v_source_allocation
    FROM item_stage_allocations
    WHERE id = p_allocation_id
      AND item_id = p_item_id
      AND stage_id = p_from_stage_id
      AND organization_id = p_organization_id
      AND quantity >= p_quantity
    FOR UPDATE;
    
    IF NOT FOUND THEN
        success := FALSE;
        message := 'Source allocation not found or insufficient quantity';
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Handle source allocation (reduce or delete)
    IF v_source_allocation.quantity = p_quantity THEN
        -- Full move - delete source allocation
        DELETE FROM item_stage_allocations WHERE id = p_allocation_id;
    ELSE  
        -- Partial move - reduce source allocation
        UPDATE item_stage_allocations
        SET quantity = quantity - p_quantity,
            updated_at = v_timestamp
        WHERE id = p_allocation_id;
    END IF;
    
    -- Check if target allocation exists with same allocation type as source
    SELECT * INTO v_target_allocation
    FROM item_stage_allocations
    WHERE item_id = p_item_id
      AND stage_id = p_to_stage_id
      AND organization_id = p_organization_id
      AND allocation_type = v_source_allocation.allocation_type
    FOR UPDATE;
    
    IF FOUND THEN
        -- Update existing target allocation
        UPDATE item_stage_allocations
        SET quantity = quantity + p_quantity,
            updated_at = v_timestamp,
            moved_by = p_user_id
        WHERE id = v_target_allocation.id;
    ELSE
        -- Create new target allocation with same type as source
        INSERT INTO item_stage_allocations (
            item_id,
            organization_id, 
            stage_id,
            quantity,
            allocation_type, -- Keep the same allocation type as source
            created_at,
            updated_at,
            moved_by
        ) VALUES (
            p_item_id,
            p_organization_id,
            p_to_stage_id, 
            p_quantity,
            v_source_allocation.allocation_type, -- Preserve allocation type
            v_timestamp,
            v_timestamp,
            p_user_id
        );
    END IF;
    
    -- Log the movement
    INSERT INTO item_movement_history (
        item_id,
        from_stage_id,
        to_stage_id,
        quantity,
        moved_at,
        moved_by,
        organization_id
    ) VALUES (
        p_item_id,
        p_from_stage_id,
        p_to_stage_id,
        p_quantity,
        v_timestamp,
        p_user_id,
        p_organization_id
    );
    
    success := TRUE;
    message := 'Item moved successfully';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION move_items_simple TO authenticated;

-- Add comment explaining the change
COMMENT ON FUNCTION move_items_simple IS 
'Simplified item movement function that preserves allocation types.
Unlike the old logic, this function:
- Moves exactly what the user selects
- Preserves the allocation type from source to target  
- Does not prioritize normal over reworked allocations
- Requires user to specify exact allocation ID to move from';

-- Note: The actual API route changes need to be made in the TypeScript files
-- This function serves as a reference for the simplified logic