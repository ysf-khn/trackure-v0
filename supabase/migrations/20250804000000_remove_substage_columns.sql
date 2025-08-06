-- Migration: Remove Sub-Stage Columns and Complete Tree Structure Migration
-- This migration removes all references to the old two-level workflow system
-- and completes the migration to the infinite tree structure

-- Step 1: Update the scrap_item_with_replacement function to remove sub_stage references
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
        
        -- Create a new scrapped item entry for tracking
        INSERT INTO items (
            organization_id,
            order_id,
            sku,
            total_quantity,
            is_scrapped,
            scrapped_at,
            scrapped_by,
            scrapped_from_stage_id
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            p_quantity,
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
        -- Create new replacement item
        INSERT INTO items (
            organization_id,
            order_id,
            sku,
            total_quantity,
            is_replacement,
            replaced_item_id
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            p_quantity,
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

-- Step 2: Update enhanced_rework_items function to remove sub_stage references
CREATE OR REPLACE FUNCTION enhanced_rework_items(
    p_items JSONB,
    p_rework_reason TEXT,
    p_create_replacements BOOLEAN DEFAULT false
)
RETURNS TABLE (
    item_id UUID,
    action_type TEXT,
    new_stage_id UUID,
    replacement_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_item JSONB;
    v_result RECORD;
BEGIN
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            IF (v_item->>'rework_type') = 'scrapped' THEN
                -- Handle scrapping
                SELECT * INTO v_result
                FROM scrap_item_with_replacement(
                    (v_item->>'id')::UUID,
                    (v_item->>'quantity')::INTEGER,
                    p_rework_reason,
                    p_create_replacements,
                    true
                );
                
                RETURN QUERY SELECT
                    (v_item->>'id')::UUID,
                    'scrapped'::TEXT,
                    NULL::UUID,
                    v_result.replacement_item_id,
                    true,
                    v_result.message;
                    
            ELSIF (v_item->>'rework_type') = 'backward' THEN
                -- Handle backward movement
                -- Get current allocation
                WITH current_alloc AS (
                    SELECT * FROM item_stage_allocations
                    WHERE item_id = (v_item->>'id')::UUID
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                -- Move to target stage
                UPDATE item_stage_allocations
                SET 
                    stage_id = (v_item->>'target_stage_id')::UUID,
                    updated_at = NOW(),
                    moved_by = auth.uid()
                FROM current_alloc
                WHERE item_stage_allocations.id = current_alloc.id;
                
                -- Log the movement (without sub_stage columns)
                INSERT INTO item_movement_history (
                    item_id,
                    from_stage_id,
                    to_stage_id,
                    quantity,
                    moved_at,
                    moved_by,
                    organization_id,
                    rework_type,
                    rework_reason
                )
                SELECT
                    (v_item->>'id')::UUID,
                    ca.stage_id,
                    (v_item->>'target_stage_id')::UUID,
                    (v_item->>'quantity')::INTEGER,
                    NOW(),
                    auth.uid(),
                    i.organization_id,
                    'backward',
                    p_rework_reason
                FROM item_stage_allocations ca
                JOIN items i ON i.id = ca.item_id
                WHERE ca.item_id = (v_item->>'id')::UUID
                ORDER BY ca.created_at DESC
                LIMIT 1;
                
                RETURN QUERY SELECT
                    (v_item->>'id')::UUID,
                    'backward'::TEXT,
                    (v_item->>'target_stage_id')::UUID,
                    NULL::UUID,
                    true,
                    'Item moved backward successfully';
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT
                (v_item->>'id')::UUID,
                (v_item->>'rework_type')::TEXT,
                NULL::UUID,
                NULL::UUID,
                false,
                SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Remove sub_stage_id columns from item_movement_history
ALTER TABLE item_movement_history 
DROP COLUMN IF EXISTS from_sub_stage_id,
DROP COLUMN IF EXISTS to_sub_stage_id;

-- Step 4: Remove sub_stage_id column from item_stage_allocations
ALTER TABLE item_stage_allocations 
DROP COLUMN IF EXISTS sub_stage_id;

-- Step 5: Remove packaging_reminder_trigger_sub_stage_id from orders
ALTER TABLE orders
DROP COLUMN IF EXISTS packaging_reminder_trigger_sub_stage_id;

-- Step 6: Drop the workflow_sub_stages table
DROP TABLE IF EXISTS workflow_sub_stages CASCADE;

-- Step 7: Update the get_bottleneck_items function to remove sub_stage references
CREATE OR REPLACE FUNCTION get_bottleneck_items()
RETURNS TABLE (
    item_id UUID,
    sku TEXT,
    order_number TEXT,
    current_stage_name TEXT,
    time_in_current_stage INTERVAL,
    stage_entry_time TIMESTAMPTZ,
    quantity INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        isa.item_id,
        i.sku,
        o.order_number,
        ws.name AS current_stage_name,
        NOW() - isa.created_at AS time_in_current_stage,
        isa.created_at AS stage_entry_time,
        isa.quantity
    FROM item_stage_allocations isa
    JOIN items i ON isa.item_id = i.id
    JOIN orders o ON i.order_id = o.id
    JOIN workflow_stages ws ON isa.stage_id = ws.id
    WHERE isa.organization_id = auth.jwt() ->> 'organization_id'::UUID
    AND NOW() - isa.created_at > INTERVAL '7 days'
    AND i.is_scrapped = false
    ORDER BY time_in_current_stage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Update any views that reference sub_stages
CREATE OR REPLACE VIEW scrapped_items_summary AS
SELECT 
    i.id,
    i.sku,
    i.total_quantity as scrapped_quantity,
    i.scrapped_at,
    u.email as scrapped_by_email,
    ws.name as scrapped_from_stage,
    ws.full_path as scrapped_from_path,
    i.replaced_item_id,
    ri.id as replacement_item_id,
    o.order_number,
    o.customer_name,
    imh.scrap_reason
FROM items i
LEFT JOIN auth.users u ON u.id = i.scrapped_by
LEFT JOIN workflow_stages ws ON ws.id = i.scrapped_from_stage_id
LEFT JOIN items ri ON ri.replaced_item_id = i.id
LEFT JOIN orders o ON o.id = i.order_id
LEFT JOIN item_movement_history imh ON imh.item_id = i.id AND imh.rework_type = 'scrapped'
WHERE i.is_scrapped = true;

-- Grant necessary permissions
GRANT SELECT ON scrapped_items_summary TO authenticated;

-- Migration completed: Removes all sub_stage columns and completes migration to tree structure