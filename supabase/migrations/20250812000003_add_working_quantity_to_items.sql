-- Add working_quantity column to items table
-- This represents the quantity that is actively workable (after scrapping)
-- while total_quantity remains immutable for historical tracking

-- Add the column as nullable first to allow population
ALTER TABLE items ADD COLUMN working_quantity INTEGER;

-- Initialize working_quantity with total_quantity for all existing items
UPDATE items SET working_quantity = total_quantity;

-- Now make it NOT NULL with default and add constraints
ALTER TABLE items 
  ALTER COLUMN working_quantity SET NOT NULL,
  ALTER COLUMN working_quantity SET DEFAULT 0,
  ADD CONSTRAINT items_working_quantity_check CHECK (working_quantity >= 0),
  ADD CONSTRAINT items_working_quantity_lte_total CHECK (working_quantity <= total_quantity);

-- Add comment for clarity
COMMENT ON COLUMN items.working_quantity IS 'Mutable quantity representing workable items after scrapping. Used for allocation validation and sidebar totals.';