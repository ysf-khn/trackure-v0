-- Migration: Fix scrap_item_with_replacement function signatures
-- Purpose: Clean up duplicate function signatures and apply the corrected version

-- Step 1: Drop all existing versions of the function (with different signatures)
DROP FUNCTION IF EXISTS scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID);

-- Step 2: Recreate the function with the correct implementation
CREATE OR REPLACE FUNCTION scrap_item_with_replacement(
    p_item_id UUID,
    p_quantity INTEGER,
    p_scrap_reason TEXT,
    p_stage_id UUID,
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
    
    -- Don't allow scrapping replacement items (prevent chain scrapping)
    IF COALESCE(v_item.is_replacement, false) THEN
        RAISE EXCEPTION 'Cannot scrap replacement items. Please scrap the original item instead.';
    END IF;
    
    -- Validate that we have enough quantity to scrap
    IF p_quantity > v_item.remaining_quantity THEN
        RAISE EXCEPTION 'Cannot scrap % items. Item only has % remaining quantity.', p_quantity, v_item.remaining_quantity;
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
    IF p_create_replacement AND p_preserve_total_quantity THEN
        -- Scrap & Replace Mode: Mark portion as scrapped but maintain processable quantity via replacement
        IF p_quantity >= v_item.remaining_quantity THEN
            -- Full scrap - mark item as completed/scrapped
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
            UPDATE items 
            SET 
                remaining_quantity = remaining_quantity - p_quantity,
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
    ELSE
        -- Complete Scrap Mode: Permanent quantity loss
        IF p_quantity >= v_item.remaining_quantity THEN
            -- Full scrap
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
            -- Partial scrap
            UPDATE items 
            SET 
                remaining_quantity = remaining_quantity - p_quantity,
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
        
        -- For complete scrap, reduce order total
        UPDATE orders
        SET total_quantity = total_quantity - p_quantity
        WHERE id = v_order_id;
    END IF;
    
    scrapped_item_id := p_item_id;
    
    -- Handle stage allocation
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
    
    -- Create replacement item if requested
    IF p_create_replacement THEN
        -- CRITICAL: Replacement items are marked with is_replacement=true
        INSERT INTO items (
            organization_id,
            order_id,
            sku,
            buyer_id,
            instance_details,
            total_quantity,
            remaining_quantity,
            status,
            is_replacement,    -- Mark as replacement
            replaced_item_id,  -- Link to original
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
            p_quantity,
            'New',
            true,              -- This is a replacement item
            p_item_id,         -- Reference to original item
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
        
        -- Do NOT update order total - replacement items don't add to order quantity
        message := format('Scrapped %s units. Replacement item created for reprocessing.', p_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Scrapped %s units permanently. Order total reduced.', p_quantity);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant execute permission
GRANT EXECUTE ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Step 4: Update comments
COMMENT ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) IS 
'Fixed version that properly handles replacement items without double-counting.
Replacement items are marked with is_replacement=true and excluded from order totals.

Key behaviors:
- Replacement items don''t add to order totals
- Views exclude replacement quantities from aggregations
- Original items track scrapped quantities
- Movement history maintains full audit trail';

-- Step 5: Fix the new_order_items_consolidated view (if not already fixed)
CREATE OR REPLACE VIEW public.new_order_items_consolidated AS
WITH all_new_items AS (
    -- Get NEW items, aggregating by order+SKU but EXCLUDING replacement items from quantity calculations
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        i.buyer_id,
        -- Only sum quantities from non-replacement items
        SUM(CASE WHEN NOT COALESCE(i.is_replacement, false) THEN i.total_quantity ELSE 0 END) as total_quantity,
        SUM(CASE WHEN NOT COALESCE(i.is_replacement, false) THEN i.remaining_quantity ELSE 0 END) as total_remaining,
        MIN(i.created_at) as first_created_at,
        MAX(i.created_at) as last_created_at,
        -- Count all items (including replacements) for tracking
        COUNT(*) as item_count,
        -- Track replacement items separately
        BOOL_OR(i.is_replacement) as has_replacements,
        COUNT(CASE WHEN i.is_replacement THEN 1 END) as replacement_count,
        SUM(CASE WHEN i.is_replacement THEN i.total_quantity ELSE 0 END) as total_replacement_quantity,
        -- Get the most recent non-replacement item ID for reference
        (ARRAY_AGG(i.id ORDER BY i.is_replacement ASC, i.created_at DESC))[1] as latest_item_id
    FROM items i
    WHERE i.status = 'New' 
      AND COALESCE(i.is_scrapped, false) = false
    GROUP BY i.order_id, i.sku, i.organization_id, i.buyer_id
),
item_allocations AS (
    -- Calculate allocated quantities, excluding replacement items
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        COALESCE(SUM(isa.quantity), 0) as total_allocated
    FROM items i
    LEFT JOIN item_stage_allocations isa ON isa.item_id = i.id
    WHERE i.status = 'New'
      AND COALESCE(i.is_scrapped, false) = false
      AND NOT COALESCE(i.is_replacement, false)  -- Exclude replacement allocations
    GROUP BY i.order_id, i.sku, i.organization_id
),
original_items AS (
    -- Get original totals (non-replacement items only)
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        SUM(i.total_quantity) as original_total_quantity
    FROM items i
    WHERE NOT COALESCE(i.is_replacement, false)
      AND COALESCE(i.is_scrapped, false) = false
    GROUP BY i.order_id, i.sku, i.organization_id
),
consolidated AS (
    SELECT 
        ani.latest_item_id as item_id,
        ani.sku,
        ani.buyer_id,
        COALESCE(oi.original_total_quantity, 0) as original_item_total_quantity,
        ani.total_quantity - COALESCE(ia.total_allocated, 0) as quantity_in_new_pool,
        ani.total_remaining as remaining_quantity,
        ani.order_id,
        ani.organization_id,
        ani.first_created_at as created_at,
        'New' as status,
        ani.replacement_count,
        ani.total_replacement_quantity,
        COALESCE(oi.original_total_quantity, 0) as original_total_before_scraps
    FROM all_new_items ani
    LEFT JOIN item_allocations ia ON ani.order_id = ia.order_id
                                   AND ani.sku = ia.sku
                                   AND ani.organization_id = ia.organization_id
    LEFT JOIN original_items oi ON ani.order_id = oi.order_id
                                 AND ani.sku = oi.sku
                                 AND ani.organization_id = oi.organization_id
    WHERE ani.total_quantity - COALESCE(ia.total_allocated, 0) > 0
)
SELECT 
    c.item_id,
    c.sku,
    c.buyer_id,
    c.original_item_total_quantity,
    c.quantity_in_new_pool,
    c.remaining_quantity,
    c.order_id,
    o.order_number,
    o.customer_name,
    c.created_at,
    c.organization_id,
    c.status,
    c.replacement_count,
    c.total_replacement_quantity,
    c.original_total_before_scraps
FROM consolidated c
JOIN orders o ON c.order_id = o.id
ORDER BY c.created_at DESC;

-- Step 6: Create or replace helper functions
CREATE OR REPLACE FUNCTION get_order_actual_quantity(p_order_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
BEGIN
    -- Calculate total quantity excluding replacement items
    SELECT COALESCE(SUM(total_quantity), 0) INTO v_total
    FROM items
    WHERE order_id = p_order_id
      AND NOT COALESCE(is_replacement, false)
      AND NOT COALESCE(is_scrapped, false);
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_order_actual_quantity TO authenticated;
GRANT SELECT ON public.new_order_items_consolidated TO authenticated;