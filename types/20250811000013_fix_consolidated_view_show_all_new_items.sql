-- Fix new_order_items_consolidated view to show ALL items with status 'New', not just replacement items
-- Previous view was only showing replacement items, causing regular new items to not appear

CREATE OR REPLACE VIEW public.new_order_items_consolidated AS
WITH all_new_items AS (
    -- Get ALL items with status 'New' (both regular and replacement)
    -- Group by order_id + sku to consolidate multiple items of same SKU
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        i.buyer_id,
        SUM(i.total_quantity) as total_quantity,
        SUM(i.remaining_quantity) as total_remaining,
        MIN(i.created_at) as first_created_at,
        MAX(i.created_at) as last_created_at,
        COUNT(*) as item_count,
        -- Track if any are replacements
        BOOL_OR(i.is_replacement) as has_replacements,
        COUNT(CASE WHEN i.is_replacement THEN 1 END) as replacement_count,
        SUM(CASE WHEN i.is_replacement THEN i.total_quantity ELSE 0 END) as total_replacement_quantity,
        -- Get the most recent item ID for reference (prioritize non-replacement if exists)
        (ARRAY_AGG(i.id ORDER BY i.is_replacement ASC, i.created_at DESC))[1] as latest_item_id
    FROM items i
    WHERE i.status = 'New' 
      AND COALESCE(i.is_scrapped, false) = false  -- Exclude scrapped items
    GROUP BY i.order_id, i.sku, i.organization_id, i.buyer_id
),
item_allocations AS (
    -- Calculate total allocated quantities for items with status 'New'
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        COALESCE(SUM(isa.quantity), 0) as total_allocated
    FROM items i
    LEFT JOIN item_stage_allocations isa ON isa.item_id = i.id
    WHERE i.status = 'New'
      AND COALESCE(i.is_scrapped, false) = false
    GROUP BY i.order_id, i.sku, i.organization_id
),
original_items AS (
    -- Get original totals (for reference, includes both new and non-new items)
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        SUM(CASE WHEN NOT i.is_replacement THEN i.total_quantity ELSE 0 END) as original_total_quantity
    FROM items i
    WHERE COALESCE(i.is_scrapped, false) = false
    GROUP BY i.order_id, i.sku, i.organization_id
),
consolidated AS (
    -- Combine all the data to create consolidated entries
    SELECT 
        ani.latest_item_id as item_id,
        ani.sku,
        ani.buyer_id,
        
        -- Original total (from non-replacement items across all statuses)
        COALESCE(oi.original_total_quantity, 0) as original_item_total_quantity,
        
        -- Available quantity is total NEW quantity minus allocations
        ani.total_quantity - COALESCE(ia.total_allocated, 0) as quantity_in_new_pool,
        
        -- Remaining quantity from all NEW items
        ani.total_remaining as remaining_quantity,
        
        -- Order information
        ani.order_id,
        ani.organization_id,
        
        -- Timestamps - use first creation time
        ani.first_created_at as created_at,
        
        -- Status - always 'New' for items in this view
        'New' as status,
        
        -- Additional metadata
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
    
    -- Only show entries that have available quantity
    WHERE ani.total_quantity - COALESCE(ia.total_allocated, 0) > 0
)
-- Final select with order information joined
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
    
    -- Additional fields for debugging/UI enhancement
    c.replacement_count,
    c.total_replacement_quantity,
    c.original_total_before_scraps
FROM consolidated c
JOIN orders o ON c.order_id = o.id
ORDER BY c.created_at DESC;

-- Update comment to reflect the fix
COMMENT ON VIEW public.new_order_items_consolidated IS 
'FIXED: Shows ALL items with status ''New'' (both regular and replacement items) consolidated by order+SKU.
This view aggregates multiple items of the same SKU within an order into a single row.
Previously only showed replacement items, now shows all NEW items ready for allocation.';

-- Add index to improve performance for the new query pattern
DROP INDEX IF EXISTS idx_items_status_lookup;
CREATE INDEX idx_items_status_lookup 
ON items(status, order_id, sku, organization_id, is_replacement, is_scrapped) 
WHERE status = 'New';