-- Fix new_order_items view to show unallocated quantities from ALL items, not just 'New' status
-- This allows replacement quantities from scrap & replace to appear for reallocation

-- Drop and recreate the view to remove the status = 'New' restriction
DROP VIEW IF EXISTS public.new_order_items;

CREATE VIEW public.new_order_items AS
SELECT 
    i.id AS item_id,
    i.sku,
    i.buyer_id,
    i.total_quantity AS original_item_total_quantity,
    -- Use allocated_quantity column for direct calculation - NO JOIN needed!
    (i.working_quantity - i.allocated_quantity) AS quantity_in_new_pool,
    i.remaining_quantity,
    o.id AS order_id,
    o.order_number,
    o.customer_name,
    i.created_at,
    i.organization_id,
    i.status
FROM 
    public.items i
JOIN 
    public.orders o ON i.order_id = o.id
WHERE 
    -- REMOVED: i.status = 'New' restriction
    -- NOW: Show ANY item with unallocated quantity, regardless of status
    (i.working_quantity - i.allocated_quantity) > 0;

-- Add comment explaining the change
COMMENT ON VIEW public.new_order_items IS 
'Shows unallocated quantities available for allocation to workflow stages from ALL items (any status). This includes replacement quantities from scrap & replace operations. Uses allocated_quantity column for fast direct calculation without expensive JOINs.';

-- Verify the view includes items with 'In Workflow' status that have unallocated quantity
-- SELECT item_id, sku, status, quantity_in_new_pool FROM public.new_order_items WHERE status != 'New' LIMIT 5;