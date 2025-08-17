-- Add safety checks to new_order_items_consolidated to prevent phantom quantities
-- This ensures only genuine unallocated quantities show up, not artifacts from incomplete operations

-- Drop the view first to avoid data type conflicts
DROP VIEW IF EXISTS public.new_order_items_consolidated;

CREATE VIEW public.new_order_items_consolidated AS
WITH consolidated AS (
    SELECT 
        i.id as item_id,
        i.sku,
        i.buyer_id,
        i.total_quantity as original_item_total_quantity,
        -- Use allocated_quantity column for direct calculation
        (i.working_quantity - i.allocated_quantity) as quantity_in_new_pool,
        i.remaining_quantity,
        i.order_id,
        i.organization_id,
        i.created_at,
        i.status,
        -- Add some extra fields for backwards compatibility
        0 as replacement_count,
        0 as total_replacement_quantity,
        i.total_quantity as original_total_before_scraps,
        i.working_quantity as working_quantity_total,
        i.allocated_quantity as allocated_quantity,  -- Need to select this column for WHERE clause
        -- Add safety calculations for validation
        COALESCE((SELECT SUM(quantity) FROM item_stage_allocations WHERE item_id = i.id), 0) as actual_allocated_sum
    FROM items i
    WHERE 
        -- Show items with unallocated quantity
        (i.working_quantity - i.allocated_quantity) > 0
        -- Don't show scrapped items
        AND COALESCE(i.is_scrapped, false) = false
        -- Additional safety: ensure working_quantity is positive (not completely scrapped)
        AND i.working_quantity > 0
        -- Extra safety: validate that allocated_quantity matches reality (prevent inconsistencies)
        AND i.allocated_quantity <= i.working_quantity
)
SELECT 
    c.item_id,
    c.sku,
    c.buyer_id,
    c.original_item_total_quantity,
    -- Final safety check: use the minimum between calculated and actual to prevent phantom quantities
    LEAST(c.quantity_in_new_pool, c.working_quantity_total - c.actual_allocated_sum) as quantity_in_new_pool,
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
WHERE 
    -- Final validation: only show if there's actually unallocated quantity
    LEAST(c.quantity_in_new_pool, c.working_quantity_total - c.actual_allocated_sum) > 0
    -- And allocated_quantity is reasonable (not more than working_quantity)
    AND c.allocated_quantity <= c.working_quantity_total
ORDER BY c.created_at DESC;

-- Update comment to reflect the safety checks
COMMENT ON VIEW public.new_order_items_consolidated IS 
'Consolidated view showing unallocated quantities available for allocation. Includes multiple safety checks to prevent phantom quantities from data inconsistencies or incomplete scrap operations. Shows replacement quantities from scrap & replace operations while excluding completely scrapped quantities.';

-- Also create a diagnostic view to help identify any data inconsistencies
CREATE OR REPLACE VIEW public.item_quantity_diagnostics AS
SELECT 
    i.id,
    i.sku,
    i.status,
    i.total_quantity,
    i.working_quantity,
    i.allocated_quantity,
    i.remaining_quantity,
    COALESCE((SELECT SUM(quantity) FROM item_stage_allocations WHERE item_id = i.id), 0) as actual_allocated_sum,
    (i.working_quantity - i.allocated_quantity) as calculated_unallocated,
    (i.working_quantity - COALESCE((SELECT SUM(quantity) FROM item_stage_allocations WHERE item_id = i.id), 0)) as actual_unallocated,
    -- Identify potential issues
    CASE 
        WHEN i.allocated_quantity != COALESCE((SELECT SUM(quantity) FROM item_stage_allocations WHERE item_id = i.id), 0) 
        THEN 'allocated_quantity_mismatch'
        WHEN i.allocated_quantity > i.working_quantity 
        THEN 'allocated_exceeds_working'
        WHEN i.working_quantity > i.total_quantity 
        THEN 'working_exceeds_total'
        WHEN i.status = 'Completed' AND i.remaining_quantity != 0 
        THEN 'completed_but_remaining_nonzero'
        WHEN i.status = 'Completed' AND i.allocated_quantity != i.working_quantity 
        THEN 'completed_but_allocated_not_equal_working'
        ELSE 'ok'
    END as issue_type
FROM items i
ORDER BY 
    CASE 
        WHEN (CASE 
            WHEN i.allocated_quantity != COALESCE((SELECT SUM(quantity) FROM item_stage_allocations WHERE item_id = i.id), 0) 
            THEN 'allocated_quantity_mismatch'
            WHEN i.allocated_quantity > i.working_quantity 
            THEN 'allocated_exceeds_working'
            WHEN i.working_quantity > i.total_quantity 
            THEN 'working_exceeds_total'
            WHEN i.status = 'Completed' AND i.remaining_quantity != 0 
            THEN 'completed_but_remaining_nonzero'
            WHEN i.status = 'Completed' AND i.allocated_quantity != i.working_quantity 
            THEN 'completed_but_allocated_not_equal_working'
            ELSE 'ok'
        END) = 'ok' THEN 1 ELSE 0 
    END,  -- Show issues first
    i.updated_at DESC;

COMMENT ON VIEW public.item_quantity_diagnostics IS 'Diagnostic view to identify data inconsistencies in item quantity fields. Use this to debug issues with allocated_quantity, working_quantity, and completion status.';