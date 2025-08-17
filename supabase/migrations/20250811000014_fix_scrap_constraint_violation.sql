-- Migration: Fix Scrap Function Constraint Violation
-- Purpose: Remove item total_quantity modifications that violate database constraint
-- Problem: scrap_item_with_replacement tries to modify total_quantity which is protected
-- Solution: Focus on remaining_quantity and proper order-level quantity management

-- The constraint prevents total_quantity modification after item creation (data integrity)
-- We need to work with remaining_quantity instead and handle order totals correctly

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
    
    -- CRITICAL FIX: Handle remaining_quantity correctly based on scrap mode
    IF p_create_replacement AND p_preserve_total_quantity THEN
        -- Scrap & Replace Mode: remaining_quantity stays the same
        -- The scrapped quantity will be reprocessed via the replacement item
        -- Mark as scrapped only if entire item quantity is being scrapped
        IF p_quantity >= v_item.remaining_quantity THEN
            UPDATE items 
            SET 
                status = 'Completed',
                is_scrapped = true,
                scrapped_at = NOW(),
                scrapped_by = auth.uid(),
                scrapped_from_stage_id = p_stage_id,
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial scrap with replacement - item continues processing
            UPDATE items 
            SET updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
        
    ELSE
        -- Complete Scrap Mode: reduce remaining_quantity (permanent loss)
        IF p_quantity >= v_item.remaining_quantity THEN
            -- Scrapping all remaining quantity - mark as completely scrapped
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
            -- Partial scrap - reduce remaining quantity
            UPDATE items 
            SET 
                remaining_quantity = remaining_quantity - p_quantity,
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
    END IF;
    
    scrapped_item_id := p_item_id; -- Item ID for reference
    
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
    
    -- Handle order quantity based on scrap mode
    IF p_create_replacement THEN
        -- Scrap & Replace: Create replacement item first
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
        
        -- Order quantity handling for replacements
        IF p_preserve_total_quantity THEN
            -- Keep order total unchanged (replacement maintains quantity)
            -- No order update needed
            message := format('Scrapped %s units from item. Replacement item created in New Order Items. Original item continues processing.', p_quantity);
        ELSE
            -- This shouldn't happen (create_replacement=true with preserve_total_quantity=false)
            -- But handle it gracefully
            UPDATE orders
            SET total_quantity = total_quantity - p_quantity
            WHERE id = v_order_id;
            message := format('Scrapped %s units from item. Replacement item created but order total reduced.', p_quantity);
        END IF;
        
    ELSE
        -- Complete Scrap: No replacement, reduce order total
        UPDATE orders
        SET total_quantity = total_quantity - p_quantity
        WHERE id = v_order_id;
        
        replacement_item_id := NULL;
        message := format('Scrapped %s units from item. No replacement created. Order total reduced.', p_quantity);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Add comprehensive comment explaining the fix
COMMENT ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) IS 
'CONSTRAINT VIOLATION FIX: Removed item total_quantity modifications that violated database constraint.
Now properly handles remaining_quantity based on scrap mode:

COMPLETE SCRAP MODE (preserve_total_quantity=false):
- Reduces remaining_quantity (permanent loss)
- Reduces order total_quantity 
- No replacement item created

SCRAP & REPLACE MODE (preserve_total_quantity=true):  
- Keeps remaining_quantity unchanged (quantity reprocessed via replacement)
- Creates replacement item in New pool
- Order total_quantity unchanged

Key changes:
- Removed lines that modified item total_quantity (violates constraint)
- Fixed remaining_quantity logic for both scrap modes  
- Maintains proper order-level quantity management
- Preserves audit trail and business logic';