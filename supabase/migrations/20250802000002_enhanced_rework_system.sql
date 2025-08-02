-- Migration: Enhanced Rework System
-- This migration adds support for scrapping items and creating replacements during rework

-- Step 1: Add rework_type to item_movement_history
ALTER TABLE item_movement_history
ADD COLUMN IF NOT EXISTS rework_type TEXT CHECK (rework_type IN ('backward', 'scrapped', 'replaced')),
ADD COLUMN IF NOT EXISTS replacement_item_id UUID REFERENCES items(id),
ADD COLUMN IF NOT EXISTS scrap_reason TEXT;

-- Step 2: Add is_scrapped and replacement tracking to items
ALTER TABLE items
ADD COLUMN IF NOT EXISTS is_scrapped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scrapped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scrapped_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS scrapped_from_stage_id UUID REFERENCES workflow_stages(id),
ADD COLUMN IF NOT EXISTS is_replacement BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS replaced_item_id UUID REFERENCES items(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_is_scrapped ON items(is_scrapped);
CREATE INDEX IF NOT EXISTS idx_items_replaced_item_id ON items(replaced_item_id);
CREATE INDEX IF NOT EXISTS idx_item_movement_history_rework_type ON item_movement_history(rework_type);
CREATE INDEX IF NOT EXISTS idx_item_movement_history_replacement_item_id ON item_movement_history(replacement_item_id);

-- Step 3: Create a function to handle item scrapping with optional replacement
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
            scrapped_from_stage_id,
            created_by
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            p_quantity,
            true,
            NOW(),
            auth.uid(),
            v_current_allocation.stage_id,
            auth.uid()
        )
        RETURNING id INTO scrapped_item_id;
    END IF;
    
    -- Log the scrap movement
    INSERT INTO item_movement_history (
        item_id,
        from_stage_id,
        from_sub_stage_id,
        to_stage_id,
        to_sub_stage_id,
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
        v_current_allocation.sub_stage_id,
        NULL, -- Scrapped items don't move to another stage
        NULL,
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
            replaced_item_id,
            created_by
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            p_quantity,
            true,
            scrapped_item_id,
            auth.uid()
        )
        RETURNING id INTO v_new_item_id;
        
        -- Get the first stage of the workflow for this item
        -- Find the first leaf stage in the workflow for this SKU or organization
        WITH first_leaf_stage AS (
            SELECT id
            FROM workflow_stages
            WHERE organization_id = v_organization_id
            AND is_leaf_stage = true
            AND (sku = v_sku OR (sku IS NULL AND NOT EXISTS (
                SELECT 1 FROM workflow_stages ws2 
                WHERE ws2.organization_id = v_organization_id 
                AND ws2.sku = v_sku
            )))
            ORDER BY sequence_order
            LIMIT 1
        )
        -- Create initial allocation in first stage
        INSERT INTO item_stage_allocations (
            item_id,
            organization_id,
            stage_id,
            sub_stage_id,
            quantity,
            moved_by
        )
        SELECT
            v_new_item_id,
            v_organization_id,
            id,
            NULL,
            p_quantity,
            auth.uid()
        FROM first_leaf_stage;
        
        -- Log the replacement
        UPDATE item_movement_history
        SET replacement_item_id = v_new_item_id
        WHERE id = (
            SELECT id FROM item_movement_history
            WHERE item_id = scrapped_item_id
            AND rework_type = 'scrapped'
            ORDER BY moved_at DESC
            LIMIT 1
        );
        
        replacement_item_id := v_new_item_id;
        message := format('Item scrapped (qty: %s) and replacement created', p_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Item scrapped (qty: %s) without replacement', p_quantity);
    END IF;
    
    -- Update order total quantity if not preserving
    IF NOT p_preserve_total_quantity AND v_order_id IS NOT NULL THEN
        UPDATE orders
        SET total_quantity = total_quantity - p_quantity
        WHERE id = v_order_id;
    END IF;
    
    RETURN QUERY SELECT scrapped_item_id, replacement_item_id, message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create enhanced rework function that supports backward movement and scrapping
CREATE OR REPLACE FUNCTION enhanced_rework_items(
    p_items JSONB, -- Array of {id, quantity, rework_type, target_stage_id}
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
                -- Handle backward movement (existing rework logic)
                -- This would call your existing rework function or implement the logic here
                -- For now, we'll create a placeholder
                
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
                
                -- Log the movement
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

-- Step 5: Create view for tracking scrapped items
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

-- Grant access to the view
GRANT SELECT ON scrapped_items_summary TO authenticated;

-- Step 6: Update dashboard functions to exclude scrapped items
-- This ensures scrapped items don't appear in active counts
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
    active_orders BIGINT,
    active_items BIGINT,
    rework_items BIGINT,
    completed_today BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'completed')::BIGINT as active_orders,
        COUNT(DISTINCT i.id) FILTER (WHERE NOT i.is_scrapped)::BIGINT as active_items,
        COUNT(DISTINCT rw.item_id)::BIGINT as rework_items,
        COUNT(DISTINCT ct.item_id)::BIGINT as completed_today
    FROM orders o
    LEFT JOIN items i ON o.id = i.order_id AND o.organization_id = i.organization_id
    LEFT JOIN (
        SELECT DISTINCT item_id 
        FROM item_movement_history 
        WHERE rework_reason IS NOT NULL 
        AND moved_at > NOW() - INTERVAL '7 days'
        AND rework_type = 'backward'
    ) rw ON i.id = rw.item_id
    LEFT JOIN (
        SELECT DISTINCT isa.item_id
        FROM item_stage_allocations isa
        JOIN workflow_stages ws ON isa.stage_id = ws.id
        WHERE ws.name = 'Completed'
        AND DATE(isa.created_at) = CURRENT_DATE
    ) ct ON i.id = ct.item_id
    WHERE o.organization_id = auth.jwt() ->> 'organization_id'::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN item_movement_history.rework_type IS 'Type of rework: backward (move to previous stage), scrapped (item destroyed), replaced (new item created)';
COMMENT ON COLUMN item_movement_history.replacement_item_id IS 'ID of replacement item if one was created during scrapping';
COMMENT ON COLUMN items.is_scrapped IS 'True if item has been scrapped/destroyed';
COMMENT ON COLUMN items.is_replacement IS 'True if item was created as a replacement for a scrapped item';
COMMENT ON FUNCTION scrap_item_with_replacement IS 'Handles scrapping items with optional replacement creation';
COMMENT ON FUNCTION enhanced_rework_items IS 'Processes multiple rework actions including backward movement and scrapping';