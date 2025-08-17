-- Fix critical scrap function bug: properly reduce item total_quantity
-- The original function had a fundamental flaw where it didn't reduce the original item's 
-- total_quantity when scrapping, causing UI to show incorrect totals (e.g., 601 instead of 599)

CREATE OR REPLACE FUNCTION scrap_item_with_replacement(
    p_item_id UUID,
    p_quantity INTEGER,
    p_scrap_reason TEXT,
    p_stage_id UUID,  -- Which stage to scrap from
    p_create_replacement BOOLEAN DEFAULT false,
    p_preserve_total_quantity BOOLEAN DEFAULT true
)
RETURNS TABLE (
    scrapped_item_id UUID,
    replacement_item_id UUID,
    message TEXT
) AS $$
DECLARE
    v_item RECORD;
    v_current_allocation RECORD;
    v_new_replacement_id UUID;
    v_organization_id UUID;
    v_sku TEXT;
    v_order_id UUID;
    v_is_allocation_total_scrap BOOLEAN;
    v_new_item_total_quantity INTEGER;
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
    
    -- Validate that we have enough quantity to scrap
    IF p_quantity > v_item.total_quantity THEN
        RAISE EXCEPTION 'Cannot scrap % items. Item only has % total quantity.', p_quantity, v_item.total_quantity;
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
    
    -- Calculate new item total quantity after scrap
    v_new_item_total_quantity := v_item.total_quantity - p_quantity;
    
    -- CRITICAL FIX: Always reduce the original item's total_quantity
    IF v_new_item_total_quantity > 0 THEN
        -- Reduce item's total quantity but keep the item
        UPDATE items 
        SET 
            total_quantity = v_new_item_total_quantity,
            remaining_quantity = GREATEST(0, remaining_quantity - p_quantity),
            updated_at = NOW()
        WHERE id = p_item_id;
        
        scrapped_item_id := p_item_id; -- Item still exists with reduced quantity
        
    ELSE
        -- Item quantity reaches 0, mark as completely scrapped
        UPDATE items 
        SET 
            total_quantity = 0,
            remaining_quantity = 0,
            status = 'Completed',
            is_scrapped = true,
            scrapped_at = NOW(),
            scrapped_by = auth.uid(),
            scrapped_from_stage_id = p_stage_id,
            updated_at = NOW()
        WHERE id = p_item_id;
        
        scrapped_item_id := p_item_id; -- Item exists but marked as scrapped
    END IF;
    
    -- Handle stage allocation
    IF v_is_allocation_total_scrap THEN
        -- Remove entire allocation from this stage
        DELETE FROM item_stage_allocations
        WHERE id = v_current_allocation.id;
    ELSE
        -- Reduce allocation quantity
        UPDATE item_stage_allocations
        SET 
            quantity = quantity - p_quantity,
            updated_at = NOW()
        WHERE id = v_current_allocation.id;
    END IF;
    
    -- Log the scrap movement for audit trail
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
        NULL, -- Scrapped items don't move to another stage
        p_quantity,
        NOW(),
        auth.uid(),
        v_organization_id,
        'scrapped',
        p_scrap_reason,
        p_scrap_reason
    );
    
    -- Update order total quantity (reduce by scrapped amount)
    UPDATE orders
    SET total_quantity = total_quantity - p_quantity
    WHERE id = v_order_id;
    
    -- Create replacement item ONLY if explicitly requested
    IF p_create_replacement THEN
        INSERT INTO items (
            organization_id,
            order_id,
            sku,
            buyer_id,
            instance_details,
            total_quantity,
            remaining_quantity,
            status,
            is_replacement,
            replaced_item_id,
            created_at,
            updated_at
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            v_item.buyer_id,
            v_item.instance_details,
            p_quantity,
            p_quantity, -- Replacement starts with full remaining quantity
            'New', -- Stays in New Order Items until manually allocated
            true,
            p_item_id, -- Reference to original item
            NOW(),
            NOW()
        )
        RETURNING id INTO v_new_replacement_id;
        
        -- Update movement history with replacement reference
        UPDATE item_movement_history
        SET replacement_item_id = v_new_replacement_id
        WHERE item_id = p_item_id
          AND rework_type = 'scrapped'
          AND moved_at = (
              SELECT MAX(moved_at)
              FROM item_movement_history
              WHERE item_id = p_item_id
          );
        
        replacement_item_id := v_new_replacement_id;
        
        -- Restore order quantity if preserve_total_quantity is enabled
        IF p_preserve_total_quantity THEN
            UPDATE orders
            SET total_quantity = total_quantity + p_quantity
            WHERE id = v_order_id;
        END IF;
        
        message := format('Scrapped %s units from item. Replacement item created in New Order Items. Original item now has %s units.', 
                         p_quantity, v_new_item_total_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Scrapped %s units from item. No replacement created. Original item now has %s units.', 
                         p_quantity, v_new_item_total_quantity);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Add comprehensive comment explaining the fix
COMMENT ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) IS 
'FIXED VERSION: Critical bug fix for scrap functionality. Now properly reduces original item total_quantity 
when scrapping instead of creating separate tracking items. This prevents UI showing incorrect totals 
(e.g., 601 instead of 599 when scrapping 1 from 600). Only creates new items when replacement is explicitly requested.

Key changes:
- Always reduces original item total_quantity by scrapped amount  
- Never creates separate "scrapped tracking" items for complete scraps
- Only creates replacement items when p_create_replacement = true
- Maintains proper audit trail in movement history
- Handles both partial allocation scraps and complete item scraps correctly';