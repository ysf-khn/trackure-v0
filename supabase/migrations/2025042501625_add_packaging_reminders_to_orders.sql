-- Add comments to the new columns
COMMENT ON COLUMN public.orders.required_packaging_materials IS 'List of packaging materials required for the order.';

COMMENT ON COLUMN public.orders.packaging_reminder_trigger_stage_id IS 'FK to workflow_stages. The stage entry that triggers the packaging reminder.';

COMMENT ON COLUMN public.orders.packaging_reminder_trigger_sub_stage_id IS 'FK to workflow_sub_stages. The sub-stage entry that triggers the packaging reminder.';

COMMENT ON COLUMN public.orders.packaging_reminder_sent IS 'Flag indicating if the packaging reminder has been sent for this order.';