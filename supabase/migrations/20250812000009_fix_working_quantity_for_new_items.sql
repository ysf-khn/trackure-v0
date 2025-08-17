-- Fix working_quantity issues for new items
-- This migration creates a trigger to automatically set working_quantity = total_quantity on INSERT
-- and fixes any existing items where working_quantity = 0

-- Step 1: Create trigger function to set working_quantity = total_quantity on INSERT
CREATE OR REPLACE FUNCTION set_working_quantity_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- If working_quantity is not explicitly set or is 0, set it to total_quantity
    IF NEW.working_quantity IS NULL OR NEW.working_quantity = 0 THEN
        NEW.working_quantity := NEW.total_quantity;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the trigger
DROP TRIGGER IF EXISTS set_working_quantity_trigger ON items;
CREATE TRIGGER set_working_quantity_trigger
    BEFORE INSERT ON items
    FOR EACH ROW
    EXECUTE FUNCTION set_working_quantity_on_insert();

-- Step 3: Fix existing items where working_quantity = 0 (data cleanup)
UPDATE items 
SET working_quantity = total_quantity 
WHERE working_quantity = 0 
  AND total_quantity > 0;

-- Add comment explaining the trigger
COMMENT ON FUNCTION set_working_quantity_on_insert() IS 
'Automatically sets working_quantity = total_quantity for new items when working_quantity is not provided or is 0. Ensures new items are immediately workable and appear in New Order Items view.';

COMMENT ON TRIGGER set_working_quantity_trigger ON items IS 
'Ensures working_quantity is properly initialized for new items to match total_quantity.';