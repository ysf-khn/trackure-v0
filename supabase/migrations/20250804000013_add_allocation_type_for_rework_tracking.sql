-- Add allocation type to distinguish normal vs reworked items in stages
-- This enables proper tracking of normal and reworked items separately per stage

-- Add allocation_type column to item_stage_allocations
ALTER TABLE item_stage_allocations 
ADD COLUMN allocation_type TEXT NOT NULL DEFAULT 'normal' 
CHECK (allocation_type IN ('normal', 'reworked'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_item_stage_allocations_allocation_type 
ON item_stage_allocations(allocation_type);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_item_stage_allocations_stage_type 
ON item_stage_allocations(stage_id, allocation_type);

-- Update existing data to have allocation_type = 'normal'
-- All existing allocations are considered normal since rework tracking didn't exist before
UPDATE item_stage_allocations 
SET allocation_type = 'normal' 
WHERE allocation_type IS NULL OR allocation_type = 'normal';

-- Add comment for documentation
COMMENT ON COLUMN item_stage_allocations.allocation_type IS 
'Tracks whether items in this allocation are normal workflow items or reworked items';