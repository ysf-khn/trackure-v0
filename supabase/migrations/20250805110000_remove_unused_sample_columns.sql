-- Remove unused columns from samples table
-- These fields are not needed in our simplified sample schema

-- First, drop the dependent view
DROP VIEW IF EXISTS sample_search_view;

-- Remove unused columns from samples table
ALTER TABLE samples 
DROP COLUMN IF EXISTS sample_code,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS received_date,
DROP COLUMN IF EXISTS received_from;

-- Add quantity and size columns that we need
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT '';

-- Update any existing samples to have default values
UPDATE samples 
SET quantity = 1, size = 'Unknown'
WHERE quantity IS NULL OR size IS NULL OR size = '';

-- Recreate the sample_search_view without the removed columns
CREATE OR REPLACE VIEW sample_search_view AS
SELECT 
  s.id,
  s.organization_id,
  s.name,
  s.sku,
  im.master_details->>'name' as sku_name,
  s.location,
  s.quantity,
  s.size,
  s.created_at,
  s.updated_at,
  -- Aggregate attributes into JSONB
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', sa.attribute_name,
        'value', sa.attribute_value,
        'unit', sa.attribute_unit,
        'category', sa.attribute_category
      ) ORDER BY sa.display_order
    ) FILTER (WHERE sa.id IS NOT NULL), 
    '[]'::jsonb
  ) as attributes,
  -- Count of sample images
  COALESCE(si.image_count, 0) as image_count
FROM samples s
LEFT JOIN item_master im ON s.sku = im.sku AND s.organization_id = im.organization_id
LEFT JOIN sample_attributes sa ON s.id = sa.sample_id
LEFT JOIN (
  SELECT sample_id, COUNT(*) as image_count
  FROM sample_images
  GROUP BY sample_id
) si ON s.id = si.sample_id
GROUP BY s.id, s.organization_id, s.name, s.sku, im.master_details, s.location, s.quantity, s.size, s.created_at, s.updated_at, si.image_count;