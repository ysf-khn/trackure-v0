-- Update new_order_items view to use allocated_quantity column instead of complex JOIN
-- This provides much faster performance and direct calculation

-- Drop the existing view first to allow data type change
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
    i.status = 'New' 
    AND (i.working_quantity - i.allocated_quantity) > 0;

-- Add comment explaining the improvement
COMMENT ON VIEW public.new_order_items IS 
'Shows items available for allocation to workflow stages. Uses allocated_quantity column for fast direct calculation instead of expensive JOINs. Replacement quantities from scrap & replace operations appear here automatically.';

-- Verify the view works correctly
-- This query should return items with unallocated quantity
-- SELECT item_id, sku, quantity_in_new_pool FROM public.new_order_items LIMIT 5;