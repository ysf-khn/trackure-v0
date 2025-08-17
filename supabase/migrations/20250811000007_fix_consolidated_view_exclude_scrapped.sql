-- Fix new_order_items_consolidated view to exclude scrapped tracking items
-- The old broken scrap logic created separate scrapped items that were being counted
-- in aggregations, causing incorrect quantity displays (e.g., 601 instead of 599)

CREATE OR REPLACE VIEW public.new_order_items_consolidated AS
WITH replacement_items AS (
    -- Aggregate all replacement items by order_id + sku
    -- DEFENSIVE FIX: Exclude scrapped items to prevent double-counting
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        i.buyer_id,
        SUM(i.total_quantity) as total_replacement_quantity,
        SUM(i.remaining_quantity) as total_replacement_remaining,
        MIN(i.created_at) as first_replacement_created_at,
        MAX(i.created_at) as last_replacement_created_at,
        COUNT(*) as replacement_count,
        -- Get the most recent replacement item ID for reference
        (ARRAY_AGG(i.id ORDER BY i.created_at DESC))[1] as latest_replacement_id
    FROM items i
    WHERE i.status = 'New' 
      AND i.is_replacement = true
      AND COALESCE(i.is_scrapped, false) = false  -- EXCLUDE scrapped tracking items
    GROUP BY i.order_id, i.sku, i.organization_id, i.buyer_id
),
replacement_allocations AS (
    -- Calculate total allocated quantities for replacement items
    -- DEFENSIVE FIX: Exclude scrapped items from allocation calculations
    SELECT 
        ri.order_id,
        ri.sku,
        ri.organization_id,
        COALESCE(SUM(isa.quantity), 0) as total_allocated_replacement
    FROM replacement_items ri
    LEFT JOIN items i ON i.order_id = ri.order_id 
                      AND i.sku = ri.sku 
                      AND i.is_replacement = true 
                      AND i.status = 'New'
                      AND COALESCE(i.is_scrapped, false) = false  -- EXCLUDE scrapped items
    LEFT JOIN item_stage_allocations isa ON isa.item_id = i.id
    GROUP BY ri.order_id, ri.sku, ri.organization_id
),
original_items AS (
    -- Get original (non-replacement) items to calculate true original totals
    -- DEFENSIVE FIX: Exclude scrapped tracking items (but include items marked scrapped after being reduced to 0)
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        SUM(i.total_quantity) as original_total_quantity,
        -- Count items that still have quantity or are properly marked as scrapped
        COUNT(CASE WHEN i.total_quantity > 0 OR (i.total_quantity = 0 AND i.is_scrapped = true) THEN 1 END) as valid_original_count,
        MIN(i.created_at) as original_created_at
    FROM items i
    WHERE i.is_replacement = false
      -- CRITICAL: Only exclude scrapped items that were created as tracking items (have 0 original quantity)
      -- Keep items that were reduced to 0 through proper scrapping
      AND NOT (COALESCE(i.is_scrapped, false) = true AND i.total_quantity > 0)
    GROUP BY i.order_id, i.sku, i.organization_id
),
scrap_adjustments AS (
    -- Calculate how much of original quantity was completely scrapped
    -- Only count items that were completely scrapped (total_quantity = 0 AND is_scrapped = true)
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        COALESCE(SUM(
            CASE 
                WHEN i.is_scrapped = true AND i.total_quantity = 0 THEN 0  -- Already counted correctly in original_total_quantity
                ELSE 0 
            END
        ), 0) as completely_scrapped_quantity
    FROM items i
    WHERE i.is_replacement = false
    GROUP BY i.order_id, i.sku, i.organization_id
),
consolidated AS (
    -- Combine all the data to create consolidated entries
    SELECT 
        -- Use replacement item ID if available, otherwise create synthetic ID
        COALESCE(ri.latest_replacement_id, gen_random_uuid()) as item_id,
        
        -- Basic item information
        COALESCE(ri.sku, oi.sku) as sku,
        COALESCE(ri.buyer_id, NULL) as buyer_id,
        
        -- FIXED: Original total is already correct after scrap function fix
        COALESCE(oi.original_total_quantity, 0) as original_item_total_quantity,
        
        -- Available quantity is replacement quantity minus allocations
        COALESCE(ri.total_replacement_quantity, 0) - COALESCE(ra.total_allocated_replacement, 0) as quantity_in_new_pool,
        
        -- Remaining quantity from replacements
        COALESCE(ri.total_replacement_remaining, 0) as remaining_quantity,
        
        -- Order information
        COALESCE(ri.order_id, oi.order_id) as order_id,
        COALESCE(ri.organization_id, oi.organization_id) as organization_id,
        
        -- Timestamps - use original creation time if available, otherwise first replacement
        COALESCE(oi.original_created_at, ri.first_replacement_created_at) as created_at,
        
        -- Status - always 'New' for items in this view
        'New' as status,
        
        -- Additional metadata for debugging/tracking
        COALESCE(ri.replacement_count, 0) as replacement_count,
        COALESCE(ri.total_replacement_quantity, 0) as total_replacement_quantity,
        COALESCE(oi.original_total_quantity, 0) as original_total_before_scraps
        
    FROM replacement_items ri
    FULL OUTER JOIN original_items oi ON ri.order_id = oi.order_id 
                                      AND ri.sku = oi.sku 
                                      AND ri.organization_id = oi.organization_id
    LEFT JOIN replacement_allocations ra ON COALESCE(ri.order_id, oi.order_id) = ra.order_id
                                         AND COALESCE(ri.sku, oi.sku) = ra.sku
                                         AND COALESCE(ri.organization_id, oi.organization_id) = ra.organization_id
    LEFT JOIN scrap_adjustments sa ON COALESCE(ri.order_id, oi.order_id) = sa.order_id
                                    AND COALESCE(ri.sku, oi.sku) = sa.sku
                                    AND COALESCE(ri.organization_id, oi.organization_id) = sa.organization_id
    
    -- Only show entries that have available replacement quantity
    WHERE COALESCE(ri.total_replacement_quantity, 0) - COALESCE(ra.total_allocated_replacement, 0) > 0
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
'FIXED VERSION: Consolidated view of new order items that aggregates replacement items by order+SKU. 
Added defensive filters to exclude scrapped tracking items created by old broken scrap logic.
This prevents quantity double-counting (e.g., 601 instead of 599) by ensuring only valid items are counted.
Shows single entry per order+SKU combination instead of multiple replacement item rows.';

-- Recreate indexes for better performance with new filters
DROP INDEX IF EXISTS idx_items_replacement_lookup;
CREATE INDEX idx_items_replacement_lookup 
ON items(order_id, sku, organization_id, is_replacement, status, is_scrapped) 
WHERE status = 'New';

DROP INDEX IF EXISTS idx_items_scrap_lookup;
CREATE INDEX idx_items_scrap_lookup 
ON items(order_id, sku, organization_id, is_scrapped, is_replacement, total_quantity);