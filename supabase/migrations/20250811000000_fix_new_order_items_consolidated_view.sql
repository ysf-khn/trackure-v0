-- Fix new_order_items_consolidated view to show both regular and replacement items
-- Previous version only showed replacement items, causing regular new items to not appear

DROP VIEW IF EXISTS public.new_order_items_consolidated;

CREATE VIEW public.new_order_items_consolidated AS
WITH 
-- Get regular (non-replacement) items with status 'New'
regular_new_items AS (
    SELECT 
        i.id as item_id,
        i.sku,
        i.buyer_id,
        i.total_quantity as original_item_total_quantity,
        -- Calculate unallocated quantity (total - allocated)
        i.total_quantity - COALESCE(
            (SELECT SUM(isa.quantity) 
             FROM item_stage_allocations isa 
             WHERE isa.item_id = i.id), 0
        ) as quantity_in_new_pool,
        i.remaining_quantity,
        i.order_id,
        i.organization_id,
        i.created_at,
        'New' as status,
        -- Metadata for regular items
        0 as replacement_count,
        0 as total_replacement_quantity,
        i.total_quantity as original_total_before_scraps
    FROM items i
    WHERE i.status = 'New' 
      AND (i.is_replacement = false OR i.is_replacement IS NULL)
      -- Only show items with unallocated quantity
      AND i.total_quantity - COALESCE(
            (SELECT SUM(isa.quantity) 
             FROM item_stage_allocations isa 
             WHERE isa.item_id = i.id), 0
        ) > 0
),
-- Aggregate replacement items by order_id + sku (existing logic)
replacement_items AS (
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
    GROUP BY i.order_id, i.sku, i.organization_id, i.buyer_id
),
replacement_allocations AS (
    -- Calculate total allocated quantities for replacement items
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
    LEFT JOIN item_stage_allocations isa ON isa.item_id = i.id
    GROUP BY ri.order_id, ri.sku, ri.organization_id
),
original_items_for_replacements AS (
    -- Get original (non-replacement) items to calculate true original totals for replacement groups
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        SUM(i.total_quantity) as original_total_quantity,
        COUNT(CASE WHEN NOT i.is_scrapped THEN 1 END) as non_scrapped_original_count,
        MIN(i.created_at) as original_created_at
    FROM items i
    WHERE i.is_replacement = false
    GROUP BY i.order_id, i.sku, i.organization_id
),
scrap_adjustments AS (
    -- Calculate how much of original quantity was completely scrapped
    SELECT 
        i.order_id,
        i.sku,
        i.organization_id,
        COALESCE(SUM(
            CASE 
                WHEN i.is_scrapped = true THEN i.total_quantity 
                ELSE 0 
            END
        ), 0) as completely_scrapped_quantity
    FROM items i
    WHERE i.is_replacement = false
    GROUP BY i.order_id, i.sku, i.organization_id
),
consolidated_replacements AS (
    -- Combine replacement item data (existing logic from original view)
    SELECT 
        COALESCE(ri.latest_replacement_id, gen_random_uuid()) as item_id,
        COALESCE(ri.sku, oi.sku) as sku,
        COALESCE(ri.buyer_id, NULL) as buyer_id,
        -- Calculate adjusted original total (original - completely scrapped)
        COALESCE(oi.original_total_quantity, 0) - COALESCE(sa.completely_scrapped_quantity, 0) as original_item_total_quantity,
        -- Available quantity is replacement quantity minus allocations
        COALESCE(ri.total_replacement_quantity, 0) - COALESCE(ra.total_allocated_replacement, 0) as quantity_in_new_pool,
        COALESCE(ri.total_replacement_remaining, 0) as remaining_quantity,
        COALESCE(ri.order_id, oi.order_id) as order_id,
        COALESCE(ri.organization_id, oi.organization_id) as organization_id,
        -- Use original creation time if available, otherwise first replacement
        COALESCE(oi.original_created_at, ri.first_replacement_created_at) as created_at,
        'New' as status,
        -- Additional metadata
        COALESCE(ri.replacement_count, 0) as replacement_count,
        COALESCE(ri.total_replacement_quantity, 0) as total_replacement_quantity,
        COALESCE(oi.original_total_quantity, 0) as original_total_before_scraps
    FROM replacement_items ri
    FULL OUTER JOIN original_items_for_replacements oi ON ri.order_id = oi.order_id 
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
),
-- Combine regular items and consolidated replacement items
all_items AS (
    SELECT * FROM regular_new_items
    UNION ALL
    SELECT * FROM consolidated_replacements
)
-- Final select with order information joined
SELECT 
    ai.item_id,
    ai.sku,
    ai.buyer_id,
    ai.original_item_total_quantity,
    ai.quantity_in_new_pool,
    ai.remaining_quantity,
    ai.order_id,
    o.order_number,
    o.customer_name,
    ai.created_at,
    ai.organization_id,
    ai.status,
    -- Additional fields for debugging/UI enhancement
    ai.replacement_count,
    ai.total_replacement_quantity,
    ai.original_total_before_scraps
FROM all_items ai
JOIN orders o ON ai.order_id = o.id
ORDER BY ai.created_at DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.new_order_items_consolidated TO authenticated;

-- Update comment
COMMENT ON VIEW public.new_order_items_consolidated IS 
'Consolidated view of new order items that shows both regular items and aggregated replacement items.
Regular items (is_replacement = false/null) appear as individual entries.
Replacement items (is_replacement = true) are aggregated by order+SKU combination.
Only shows items with unallocated quantities available in the New pool.';