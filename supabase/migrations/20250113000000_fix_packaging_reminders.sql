-- Migration to fix packaging reminders functionality
-- Use existing total_quantity field instead of creating a new one

-- Update comment on existing total_quantity field to clarify its use in packaging reminders
COMMENT ON COLUMN public.orders.total_quantity IS 'Total quantity of items in this order. Used for percentage calculation in packaging reminders.';

-- Create a function to automatically update total_quantity when items are added/removed
CREATE OR REPLACE FUNCTION update_order_total_quantity()
RETURNS TRIGGER AS $$
DECLARE
    order_total integer;
BEGIN
    -- Calculate the total quantity of all items in the order
    SELECT COALESCE(SUM(total_quantity), 0) 
    INTO order_total
    FROM public.items 
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);
    
    -- Update the order's total_quantity field
    UPDATE public.orders 
    SET total_quantity = GREATEST(order_total, 1) -- Ensure it's at least 1 due to CHECK constraint
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to automatically update the count
DROP TRIGGER IF EXISTS trigger_update_order_total_quantity_on_insert ON public.items;
DROP TRIGGER IF EXISTS trigger_update_order_total_quantity_on_update ON public.items;
DROP TRIGGER IF EXISTS trigger_update_order_total_quantity_on_delete ON public.items;

CREATE TRIGGER trigger_update_order_total_quantity_on_insert
    AFTER INSERT ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_total_quantity();

CREATE TRIGGER trigger_update_order_total_quantity_on_update
    AFTER UPDATE OF total_quantity ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_total_quantity();

CREATE TRIGGER trigger_update_order_total_quantity_on_delete
    AFTER DELETE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_total_quantity();

-- Update existing orders to have correct total_quantity values based on their items
UPDATE public.orders 
SET total_quantity = GREATEST((
    SELECT COALESCE(SUM(total_quantity), 0) 
    FROM public.items 
    WHERE items.order_id = orders.id
), 1) -- Ensure it's at least 1 due to CHECK constraint
WHERE EXISTS (
    SELECT 1 FROM public.items WHERE items.order_id = orders.id
);

-- Create index for efficient querying of packaging reminders
CREATE INDEX IF NOT EXISTS idx_orders_packaging_reminder_status 
ON public.orders (packaging_reminder_sent, packaging_reminder_trigger_stage_id, packaging_reminder_trigger_sub_stage_id) 
WHERE packaging_reminder_sent = false; 