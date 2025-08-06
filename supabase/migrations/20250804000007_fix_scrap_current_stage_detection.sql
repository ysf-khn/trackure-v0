-- Fix scrap function to properly detect current stage allocation
-- The issue was selecting allocations by updated_at DESC without checking if it's the active allocation
-- An item should only have ONE active allocation with status 'In Progress' at any time

CREATE OR REPLACE FUNCTION scrap_item_with_replacement(
    p_item_id UUID,
    p_quantity INTEGER,
    p_scrap_reason TEXT,
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
    v_new_item_id UUID;
    v_order_id UUID;
    v_organization_id UUID;
    v_sku TEXT;
    v_remaining_quantity INTEGER;
    v_is_total_scrap BOOLEAN;
BEGIN
    -- Get item details
    SELECT * INTO v_item
    FROM items
    WHERE id = p_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;
    
    IF v_item.is_scrapped THEN
        RAISE EXCEPTION 'Item is already scrapped';
    END IF;
    
    -- Get current allocation - FIXED: Select the active allocation where item is currently located
    SELECT * INTO v_current_allocation
    FROM item_stage_allocations
    WHERE item_id = p_item_id
      AND quantity > 0  -- Only allocations with actual quantity
      AND status = 'In Progress'  -- Only active allocations
    ORDER BY updated_at DESC  -- Most recently updated allocation (fallback)
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active allocation found for item';
    END IF;
    
    IF p_quantity > v_current_allocation.quantity THEN
        RAISE EXCEPTION 'Cannot scrap more than allocated quantity';
    END IF;
    
    v_organization_id := v_item.organization_id;
    v_sku := v_item.sku;
    v_order_id := v_item.order_id;
    v_is_total_scrap := (p_quantity = v_current_allocation.quantity);
    
    -- Log the scrap movement BEFORE any deletions (for audit trail)
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
        v_current_allocation.stage_id,
        NULL, -- Scrapped items don't move to another stage
        p_quantity,
        NOW(),
        auth.uid(),
        v_organization_id,
        'scrapped',
        p_scrap_reason,
        p_scrap_reason
    );
    
    -- Start scrapping process
    IF v_is_total_scrap THEN
        -- Total scrap: Remove item entirely from the system
        
        -- Remove allocation first (referential integrity)
        DELETE FROM item_stage_allocations
        WHERE id = v_current_allocation.id;
        
        -- Delete the item entirely (no tracking needed for totally scrapped items)
        DELETE FROM items
        WHERE id = p_item_id;
        
        -- Decrease order total quantity (item is gone from workflow)
        UPDATE orders
        SET total_quantity = total_quantity - p_quantity
        WHERE id = v_order_id;
        
        -- Set return values for total scrap
        scrapped_item_id := NULL; -- Item no longer exists
        message := format('Item totally scrapped and removed. Quantity: %s. Order quantity decreased.', p_quantity);
        
    ELSE
        -- Partial scrap: Reduce quantity in current allocation
        UPDATE item_stage_allocations
        SET 
            quantity = quantity - p_quantity,
            updated_at = NOW()
        WHERE id = v_current_allocation.id;
        
        -- Create a new scrapped item entry for tracking partial scraps
        INSERT INTO items (
            organization_id,
            order_id,
            sku,
            buyer_id,
            instance_details,
            total_quantity,
            remaining_quantity,
            status,
            is_scrapped,
            scrapped_at,
            scrapped_by,
            scrapped_from_stage_id
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            v_item.buyer_id,
            v_item.instance_details,
            p_quantity,
            0, -- Scrapped items have 0 remaining quantity
            'Completed', -- Use valid status for scrapped items
            true,
            NOW(),
            auth.uid(),
            v_current_allocation.stage_id
        )
        RETURNING id INTO scrapped_item_id;
        
        message := format('Partial scrap completed. Quantity: %s.', p_quantity);
    END IF;
    
    -- Create replacement if requested
    IF p_create_replacement THEN
        -- Create new replacement item in New Order Items (no workflow allocation)
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
            replaced_item_id
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            v_item.buyer_id,
            v_item.instance_details,
            p_quantity,
            p_quantity, -- Replacement items start with full remaining quantity
            'New', -- Stays in New Order Items until manually allocated
            true,
            COALESCE(scrapped_item_id, p_item_id) -- Handle both partial and total scrap
        )
        RETURNING id INTO v_new_item_id;
        
        -- DO NOT create item_stage_allocations - replacement stays in New Order Items
        -- User will manually allocate it to workflow when ready
        
        -- Update replacement item id in movement history
        UPDATE item_movement_history
        SET replacement_item_id = v_new_item_id
        WHERE item_id = p_item_id
          AND rework_type = 'scrapped'
          AND moved_at = (
              SELECT MAX(moved_at)
              FROM item_movement_history
              WHERE item_id = p_item_id
          );
        
        replacement_item_id := v_new_item_id;
        
        -- Update message to include replacement info
        IF v_is_total_scrap THEN
            message := format('Item totally scrapped and removed. Quantity: %s. Replacement created in New Order Items.', p_quantity);
        ELSE
            message := format('Partial scrap completed. Quantity: %s. Replacement created in New Order Items.', p_quantity);
        END IF;
        
        -- For total scrap with replacement, restore order quantity if preserve_total_quantity is true
        IF v_is_total_scrap AND p_preserve_total_quantity THEN
            UPDATE orders
            SET total_quantity = total_quantity + p_quantity
            WHERE id = v_order_id;
        END IF;
        
    ELSE
        replacement_item_id := NULL;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;