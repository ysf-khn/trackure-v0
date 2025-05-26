-- Migration: Fix Completed Stage Sequence Order
-- Purpose: Update existing completed stages to use sequence order 100000
--          instead of variable numbers like 13, 14, etc.
-- This ensures completed stages are always last regardless of how many stages are added

-- Update all existing completed stages to use sequence order 100000
UPDATE public.workflow_stages 
SET sequence_order = 100000 
WHERE name ILIKE 'completed' 
AND sequence_order != 100000;

-- Add a comment explaining the special sequence order
COMMENT ON TABLE public.workflow_stages IS 'Defines the main stages in the production/preparation workflow. Completed stages use sequence_order 100000 to ensure they are always last.';

-- Log the changes
DO $$
DECLARE
    updated_count integer;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % completed stages to sequence order 100000', updated_count;
END $$; 