-- Fix scrap_item_with_replacement function to remove created_by column references
-- The items table doesn't have a created_by column, causing 500 errors

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
    
    -- Get current allocation
    SELECT * INTO v_current_allocation
    FROM item_stage_allocations
    WHERE item_id = p_item_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No allocation found for item';
    END IF;
    
    IF p_quantity > v_current_allocation.quantity THEN
        RAISE EXCEPTION 'Cannot scrap more than allocated quantity';
    END IF;
    
    v_organization_id := v_item.organization_id;
    v_sku := v_item.sku;
    v_order_id := v_item.order_id;
    
    -- Start scrapping process
    IF p_quantity = v_current_allocation.quantity THEN
        -- Full scrap: Mark entire item as scrapped
        UPDATE items
        SET 
            is_scrapped = true,
            scrapped_at = NOW(),
            scrapped_by = auth.uid(),
            scrapped_from_stage_id = v_current_allocation.stage_id
        WHERE id = p_item_id;
        
        -- Remove allocation
        DELETE FROM item_stage_allocations
        WHERE id = v_current_allocation.id;
        
        scrapped_item_id := p_item_id;
    ELSE
        -- Partial scrap: Reduce quantity in current allocation
        UPDATE item_stage_allocations
        SET 
            quantity = quantity - p_quantity,
            updated_at = NOW()
        WHERE id = v_current_allocation.id;
        
        -- Create a new scrapped item entry for tracking (with all required fields)
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
            'Scrapped',
            true,
            NOW(),
            auth.uid(),
            v_current_allocation.stage_id
        )
        RETURNING id INTO scrapped_item_id;
    END IF;
    
    -- Log the scrap movement (without sub_stage columns)
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
        scrapped_item_id,
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
    
    -- Create replacement if requested
    IF p_create_replacement THEN
        -- Create new replacement item (with all required fields)
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
            'New',
            true,
            scrapped_item_id
        )
        RETURNING id INTO v_new_item_id;
        
        -- Get the first stage in the workflow for this SKU/org
        WITH first_stage AS (
            SELECT id
            FROM workflow_stages
            WHERE organization_id = v_organization_id
              AND (sku = v_sku OR sku IS NULL)
              AND parent_stage_id IS NULL
              AND is_leaf_stage = true
            ORDER BY sku NULLS LAST, sequence_order
            LIMIT 1
        )
        INSERT INTO item_stage_allocations (
            item_id,
            stage_id,
            quantity,
            organization_id,
            moved_by
        )
        SELECT
            v_new_item_id,
            id,
            p_quantity,
            v_organization_id,
            auth.uid()
        FROM first_stage;
        
        -- Update replacement item id in movement history
        UPDATE item_movement_history
        SET replacement_item_id = v_new_item_id
        WHERE item_id = scrapped_item_id
          AND rework_type = 'scrapped'
          AND moved_at = (
              SELECT MAX(moved_at)
              FROM item_movement_history
              WHERE item_id = scrapped_item_id
          );
        
        replacement_item_id := v_new_item_id;
        message := format('Item scrapped. Quantity: %s. Replacement created.', p_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Item scrapped. Quantity: %s. No replacement created.', p_quantity);
    END IF;
    
    -- Update order quantity if needed
    IF NOT p_preserve_total_quantity AND p_create_replacement THEN
        UPDATE orders
        SET total_quantity = total_quantity + p_quantity
        WHERE id = v_order_id;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;