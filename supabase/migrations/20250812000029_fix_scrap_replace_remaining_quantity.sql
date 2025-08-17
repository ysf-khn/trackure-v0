-- Fix scrap & replace incorrectly reducing remaining_quantity
-- Scrap & replace should NOT reduce remaining_quantity since items are being replaced

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
    
    -- CRITICAL: First handle the stage allocation (this will trigger allocated_quantity update)
    -- We do this BEFORE updating working_quantity to avoid constraint violations
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
    
    -- Now update the item based on scrap mode
    -- At this point, the trigger has already reduced allocated_quantity
    IF p_create_replacement THEN
        -- Scrap & Replace Mode: Keep working_quantity AND remaining_quantity same
        -- Only mark as completed/scrapped if ALL remaining quantity was scrapped (even though replaced)
        
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
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial scrap with replacement
            -- DO NOT reduce remaining_quantity - items are being replaced!
            -- Just update the timestamp to track the operation
            UPDATE items 
            SET 
                updated_at = NOW()  -- Only update timestamp, no quantity changes
            WHERE id = p_item_id;
        END IF;
        
        -- working_quantity stays the same in scrap & replace mode
        -- remaining_quantity stays the same (except when fully completed)
    ELSE
        -- Complete Scrap Mode: Reduce both working_quantity and remaining_quantity permanently
        -- The allocated_quantity has already been reduced by the trigger from the allocation change above
        -- So now we can safely reduce working_quantity without violating constraints
        
        IF p_quantity >= v_item.working_quantity THEN
            -- Full scrap - reduce both working and remaining quantities to 0
            UPDATE items 
            SET 
                working_quantity = 0,
                remaining_quantity = 0,
                status = 'Completed',
                is_scrapped = true,
                scrapped_at = NOW(),
                scrapped_by = auth.uid(),
                scrapped_from_stage_id = p_stage_id,
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial complete scrap - reduce working and remaining quantities
            UPDATE items 
            SET 
                working_quantity = working_quantity - p_quantity,
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
        message := format('Scrapped %s units with replacement. %s units now available as unallocated quantity for reallocation.', p_quantity, p_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Scrapped %s units permanently. Working quantity reduced. No replacement quantities available.', p_quantity);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) IS 
'Fixed scrap function - scrap & replace does NOT reduce remaining_quantity.
- Scrap & Replace: remaining_quantity unchanged (items are replaced), only allocated_quantity reduced
- Complete Scrap: both working_quantity and remaining_quantity reduced (items gone forever)
- Handles allocation changes BEFORE updating working_quantity to prevent constraint violations';