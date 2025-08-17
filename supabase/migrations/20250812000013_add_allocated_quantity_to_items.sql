-- Add allocated_quantity column to items table for robust quantity tracking
-- This eliminates the need for complex JOINs and provides direct unallocated quantity calculation

-- Add the column as nullable first to allow population
ALTER TABLE items ADD COLUMN allocated_quantity INTEGER;

-- Populate allocated_quantity with current allocation sums
-- Use COALESCE to handle items with no allocations (should be 0)
UPDATE items 
SET allocated_quantity = COALESCE(
    (SELECT SUM(quantity) 
     FROM item_stage_allocations 
     WHERE item_id = items.id), 
    0
);

-- Now make it NOT NULL with default and add constraints
ALTER TABLE items 
  ALTER COLUMN allocated_quantity SET NOT NULL,
  ALTER COLUMN allocated_quantity SET DEFAULT 0,
  ADD CONSTRAINT items_allocated_quantity_check CHECK (allocated_quantity >= 0),
  ADD CONSTRAINT items_allocated_quantity_lte_working CHECK (allocated_quantity <= working_quantity);

-- Add comment for clarity
COMMENT ON COLUMN items.allocated_quantity IS 'Current quantity allocated to workflow stages. Used to calculate unallocated pool: (working_quantity - allocated_quantity).';