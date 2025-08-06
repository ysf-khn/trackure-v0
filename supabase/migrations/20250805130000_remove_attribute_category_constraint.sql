-- Remove the restrictive check constraint on sample_attributes.attribute_category
-- This allows users to use any category value instead of being restricted to predefined ones

ALTER TABLE sample_attributes 
DROP CONSTRAINT IF EXISTS sample_attributes_attribute_category_check;