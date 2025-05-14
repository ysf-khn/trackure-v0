-- Migration: Alter check constraint for items.total_quantity
-- Purpose: Allow total_quantity to be zero when an item is fully allocated from 'New' status.
-- Step 1: Drop the existing incorrect constraint
ALTER TABLE public.items
DROP CONSTRAINT items_total_quantity_check;

-- Step 2: Add the new correct constraint
ALTER TABLE public.items ADD CONSTRAINT items_total_quantity_check CHECK (total_quantity >= 0);

COMMENT ON CONSTRAINT items_total_quantity_check ON public.items IS 'Ensures that the total quantity of an item (in its current status context, e.g., ''New'') is not negative.';