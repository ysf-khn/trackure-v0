-- Update new_order_items_consolidated to use allocated_quantity and show ALL unallocated quantities
-- This replaces the complex logic with our simple allocated_quantity approach

-- Drop the existing view first to allow data type changes
DROP VIEW IF EXISTS public.new_order_items_consolidated;

CREATE VIEW public.new_order_items_consolidated AS
WITH consolidated AS (
    SELECT 
        i.id as item_id,
        i.sku,
        i.buyer_id,
        i.total_quantity as original_item_total_quantity,
        -- Use allocated_quantity column for direct calculation - NO COMPLEX JOINS!
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
        i.working_quantity as working_quantity_total
    FROM items i
    WHERE 
        -- REMOVED: i.status = 'New' restriction
        -- NOW: Show ANY item with unallocated quantity, regardless of status
        (i.working_quantity - i.allocated_quantity) > 0
        AND COALESCE(i.is_scrapped, false) = false
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

-- Update comment to reflect the simplified approach
COMMENT ON VIEW public.new_order_items_consolidated IS 
'Simplified consolidated view using allocated_quantity column. Shows unallocated quantities from ALL items (any status) including replacement quantities from scrap & replace operations. Much faster than previous complex JOIN-based approach.';