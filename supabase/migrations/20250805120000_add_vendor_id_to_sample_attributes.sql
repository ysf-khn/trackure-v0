-- Add vendor_id column to sample_attributes table to support vendor linking

ALTER TABLE sample_attributes
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sample_attributes_vendor_id ON sample_attributes(vendor_id);

-- Update the sample_search_view to include vendor information in attributes
DROP VIEW IF EXISTS sample_search_view;

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
  -- Aggregate attributes into JSONB with vendor info
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', sa.attribute_name,
        'value', sa.attribute_value,
        'unit', sa.attribute_unit,
        'category', sa.attribute_category,
        'vendor_id', sa.vendor_id,
        'vendor_name', v.name
      ) ORDER BY sa.display_order
    ) FILTER (WHERE sa.id IS NOT NULL), 
    '[]'::jsonb
  ) as attributes,
  -- Count of sample images
  COALESCE(si.image_count, 0) as image_count
FROM samples s
LEFT JOIN item_master im ON s.sku = im.sku AND s.organization_id = im.organization_id
LEFT JOIN sample_attributes sa ON s.id = sa.sample_id
LEFT JOIN vendors v ON sa.vendor_id = v.id
LEFT JOIN (
  SELECT sample_id, COUNT(*) as image_count
  FROM sample_images
  GROUP BY sample_id
) si ON s.id = si.sample_id
GROUP BY s.id, s.organization_id, s.name, s.sku, im.master_details, s.location, s.quantity, s.size, s.created_at, s.updated_at, si.image_count;