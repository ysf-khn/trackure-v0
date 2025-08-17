-- Update new_order_items_consolidated view to use working_quantity for availability calculations
-- This ensures the view shows actual workable quantities after scrapping

CREATE OR REPLACE VIEW public.new_order_items_consolidated AS
WITH all_new_items AS (
    -- Get NEW items, aggregating by order+SKU but EXCLUDING replacement items from quantity calculations
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        i.buyer_id,
        -- Use working_quantity instead of total_quantity for workable quantities
        SUM(CASE WHEN NOT COALESCE(i.is_replacement, false) THEN i.working_quantity ELSE 0 END) as working_quantity,
        -- Keep total_quantity for reference/historical tracking
        SUM(CASE WHEN NOT COALESCE(i.is_replacement, false) THEN i.total_quantity ELSE 0 END) as total_quantity,
        SUM(CASE WHEN NOT COALESCE(i.is_replacement, false) THEN i.remaining_quantity ELSE 0 END) as total_remaining,
        MIN(i.created_at) as first_created_at,
        MAX(i.created_at) as last_created_at,
        -- Count all items (including replacements) for tracking
        COUNT(*) as item_count,
        -- Track replacement items separately
        BOOL_OR(i.is_replacement) as has_replacements,
        COUNT(CASE WHEN i.is_replacement THEN 1 END) as replacement_count,
        SUM(CASE WHEN i.is_replacement THEN i.working_quantity ELSE 0 END) as total_replacement_quantity,
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
    -- Get original totals (non-replacement items only) - keep using total_quantity here for reference
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
        -- Use working_quantity for availability calculations
        ani.working_quantity - COALESCE(ia.total_allocated, 0) as quantity_in_new_pool,
        ani.total_remaining as remaining_quantity,
        ani.order_id,
        ani.organization_id,
        ani.first_created_at as created_at,
        'New' as status,
        ani.replacement_count,
        ani.total_replacement_quantity,
        COALESCE(oi.original_total_quantity, 0) as original_total_before_scraps,
        ani.working_quantity as working_quantity_total
    FROM all_new_items ani
    LEFT JOIN item_allocations ia ON ani.order_id = ia.order_id
                                   AND ani.sku = ia.sku
                                   AND ani.organization_id = ia.organization_id
    LEFT JOIN original_items oi ON ani.order_id = oi.order_id
                                 AND ani.sku = oi.sku
                                 AND ani.organization_id = oi.organization_id
    -- Use working_quantity for availability check
    WHERE ani.working_quantity - COALESCE(ia.total_allocated, 0) > 0
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
    c.original_total_before_scraps,
    c.working_quantity_total
FROM consolidated c
JOIN orders o ON c.order_id = o.id
ORDER BY c.created_at DESC;

-- Update the get_order_actual_quantity function to use working_quantity for workable totals
CREATE OR REPLACE FUNCTION get_order_workable_quantity(p_order_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
BEGIN
    -- Calculate total workable quantity excluding replacement items
    SELECT COALESCE(SUM(working_quantity), 0) INTO v_total
    FROM items
    WHERE order_id = p_order_id
      AND NOT COALESCE(is_replacement, false)
      AND NOT COALESCE(is_scrapped, false);
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Keep the original function for backwards compatibility (uses total_quantity for historical reference)
-- No need to change get_order_actual_quantity as it serves a different purpose

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_order_workable_quantity TO authenticated;

-- Add comment explaining the change
COMMENT ON VIEW public.new_order_items_consolidated IS 'Consolidated view of new order items using working_quantity for availability calculations. Shows actual workable quantities after scrapping.';