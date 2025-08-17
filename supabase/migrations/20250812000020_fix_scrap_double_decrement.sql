-- Fix double decrement in scrap function
-- The scrap function was manually reducing allocated_quantity AND the triggers were also doing it
-- This caused allocated_quantity to be reduced twice (double decrement)

CREATE OR REPLACE FUNCTION scrap_item_with_replacement(
    p_item_id UUID,
    p_quantity INTEGER,
    p_scrap_reason TEXT,
    p_stage_id UUID,
    p_create_replacement BOOLEAN DEFAULT false,
    p_preserve_total_quantity BOOLEAN DEFAULT true -- Kept for API compatibility
)
RETURNS TABLE (
    scrapped_item_id UUID,
    replacement_item_id UUID,
    message TEXT
) AS $$
DECLARE
    v_item RECORD;
    v_current_allocation RECORD;
    v_organization_id UUID;
    v_sku TEXT;
    v_order_id UUID;
    v_is_allocation_total_scrap BOOLEAN;
BEGIN
    -- Ensure transaction consistency
    SET LOCAL synchronous_commit = 'on';
    
    -- Get item details with FOR UPDATE to prevent concurrent modifications
    SELECT * INTO v_item
    FROM items
    WHERE id = p_item_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;
    
    IF v_item.is_scrapped THEN
        RAISE EXCEPTION 'Item is already scrapped';
    END IF;
    
    -- Validate that we have enough working quantity to scrap
    IF p_quantity > v_item.working_quantity THEN
        RAISE EXCEPTION 'Cannot scrap % items. Item only has % working quantity.', p_quantity, v_item.working_quantity;
    END IF;
    
    -- Get the SPECIFIC stage allocation to scrap from
    SELECT * INTO v_current_allocation
    FROM item_stage_allocations
    WHERE item_id = p_item_id
      AND stage_id = p_stage_id  
      AND quantity > 0
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No allocation found for item in the specified stage, or quantity is 0';
    END IF;
    
    IF p_quantity > v_current_allocation.quantity THEN
        RAISE EXCEPTION 'Cannot scrap % items. Only % available in this stage.', p_quantity, v_current_allocation.quantity;
    END IF;
    
    v_organization_id := v_item.organization_id;
    v_sku := v_item.sku;
    v_order_id := v_item.order_id;
    v_is_allocation_total_scrap := (p_quantity = v_current_allocation.quantity);
    
    -- Update the original item based on scrap mode
    IF p_create_replacement THEN
        -- Scrap & Replace Mode: Keep working_quantity same
        -- DON'T manually update allocated_quantity - the triggers will handle it when we modify allocations
        
        IF p_quantity >= v_item.remaining_quantity THEN
            -- Full scrap - mark item as completed/scrapped but keep working_quantity
            UPDATE items 
            SET 
                remaining_quantity = 0,
                status = 'Completed',
                is_scrapped = true,
                scrapped_at = NOW(),
                scrapped_by = auth.uid(),
                scrapped_from_stage_id = p_stage_id,
                -- REMOVED: allocated_quantity = allocated_quantity - p_quantity, (triggers handle this)
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial scrap with replacement
            UPDATE items 
            SET 
                remaining_quantity = remaining_quantity - p_quantity,
                -- REMOVED: allocated_quantity = allocated_quantity - p_quantity, (triggers handle this)
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
        
        -- working_quantity stays the same in scrap & replace mode
        -- When we delete/update allocations below, triggers will automatically reduce allocated_quantity
    ELSE
        -- Complete Scrap Mode: Reduce working_quantity permanently
        -- Also need to manually adjust allocated_quantity to account for working_quantity change
        IF p_quantity >= v_item.working_quantity THEN
            -- Full scrap - reduce both working and remaining quantities to 0
            UPDATE items 
            SET 
                working_quantity = 0,
                allocated_quantity = 0,  -- Set to 0 since working_quantity is 0
                remaining_quantity = 0,
                status = 'Completed',
                is_scrapped = true,
                scrapped_at = NOW(),
                scrapped_by = auth.uid(),
                scrapped_from_stage_id = p_stage_id,
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial scrap - reduce working and remaining quantities
            -- For complete scrap, we need to manually adjust allocated_quantity to maintain constraint
            UPDATE items 
            SET 
                working_quantity = working_quantity - p_quantity,
                allocated_quantity = GREATEST(0, allocated_quantity - p_quantity), -- Prevent negative
                remaining_quantity = remaining_quantity - p_quantity,
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
        
        -- For complete scrap, reduce order total by working quantity change
        UPDATE orders
        SET total_quantity = total_quantity - p_quantity
        WHERE id = v_order_id;
    END IF;
    
    scrapped_item_id := p_item_id;
    
    -- Handle stage allocation (triggers will automatically update allocated_quantity)
    IF v_is_allocation_total_scrap THEN
        DELETE FROM item_stage_allocations
        WHERE id = v_current_allocation.id;
    ELSE
        UPDATE item_stage_allocations
        SET 
            quantity = quantity - p_quantity,
            updated_at = NOW()
        WHERE id = v_current_allocation.id;
    END IF;
    
    -- Log the scrap movement
    INSERT INTO item_movement_history (
        item_id,
        from_stage_id,
        to_stage_id,
        quantity,
        moved_at,
        moved_by,
        organization_id,
        rework_type,
        rework_reason,
        scrap_reason
    )
    VALUES (
        p_item_id,
        p_stage_id,
        NULL,
        p_quantity,
        NOW(),
        auth.uid(),
        v_organization_id,
        'scrapped',
        p_scrap_reason,
        p_scrap_reason
    );
    
    -- NO NEW ITEM CREATION - replacement quantity is now available as unallocated on original item
    IF p_create_replacement THEN
        replacement_item_id := NULL; -- No new item created
        message := format('Scrapped %s units. %s replacement units now available as unallocated quantity for reallocation.', p_quantity, p_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Scrapped %s units permanently. Working quantity reduced.', p_quantity);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) IS 
'Fixed scrap function - lets triggers handle allocated_quantity updates automatically.
- Complete scrap: Reduces working_quantity AND allocated_quantity  
- Scrap & replace: Triggers reduce allocated_quantity when allocation is modified
- Replacement quantity appears as unallocated: (working_quantity - allocated_quantity)
- NO new items created - eliminates unwanted item duplication';