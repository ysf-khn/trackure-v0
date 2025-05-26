-- Migration to fix the foreign key constraint for remark_id in item_images table
-- The remark_id should be BIGINT to match the remarks.id column (which is bigserial/BIGINT)

-- First, drop the existing foreign key constraint if it exists
ALTER TABLE public.item_images DROP CONSTRAINT IF EXISTS item_images_remark_id_fkey;

-- The remark_id column should already be BIGINT, but let's ensure it's correct
-- If it was somehow changed to UUID, change it back to BIGINT
ALTER TABLE public.item_images ALTER COLUMN remark_id TYPE BIGINT USING remark_id::bigint;

-- Re-add the foreign key constraint with the correct data type
ALTER TABLE public.item_images 
ADD CONSTRAINT item_images_remark_id_fkey 
FOREIGN KEY (remark_id) REFERENCES public.remarks(id) ON DELETE SET NULL;

-- Update the index to ensure it's still optimized
DROP INDEX IF EXISTS idx_item_images_remark_id;
CREATE INDEX idx_item_images_remark_id ON public.item_images(remark_id);

-- Add a comment to document the fix
COMMENT ON COLUMN public.item_images.remark_id IS 'BIGINT foreign key linking the image to a specific remark (matches remarks.id which is bigserial/BIGINT).'; 