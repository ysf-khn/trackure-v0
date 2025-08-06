-- Migration: Migrate image storage from Supabase to AWS S3
-- This migration adds S3 columns and updates existing storage structure

BEGIN;

-- Step 1: Add S3 columns to item_images table
ALTER TABLE item_images 
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS s3_url TEXT;

-- Create index on s3_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_item_images_s3_key ON item_images(s3_key);

-- Step 2: Update sample_images table structure for S3
-- First, add new columns
ALTER TABLE sample_images 
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS s3_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS content_type TEXT;

-- Create index on s3_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_sample_images_s3_key ON sample_images(s3_key);

-- Step 3: Create a function to migrate legacy storage paths to S3 URLs
-- This is optional and can be used if you want to migrate existing data
CREATE OR REPLACE FUNCTION migrate_storage_path_to_s3(
    storage_path TEXT,
    bucket_name TEXT DEFAULT 'item-images'
) RETURNS TEXT AS $$
BEGIN
    -- This function can be used to generate S3-compatible paths from Supabase storage paths
    -- For now, it just returns NULL since we're not migrating existing data
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add constraints for S3 data integrity
-- Ensure that new records have either S3 data or legacy storage_path (but not both)
ALTER TABLE item_images 
ADD CONSTRAINT check_image_storage CHECK (
    (s3_key IS NOT NULL AND s3_url IS NOT NULL AND storage_path IS NULL) OR
    (storage_path IS NOT NULL AND s3_key IS NULL AND s3_url IS NULL) OR
    (s3_key IS NULL AND s3_url IS NULL AND storage_path IS NULL)
);

-- For sample_images, we'll make image_url optional to allow for S3 migration
ALTER TABLE sample_images 
ALTER COLUMN image_url DROP NOT NULL;

-- Add constraint for sample images
ALTER TABLE sample_images 
ADD CONSTRAINT check_sample_image_storage CHECK (
    (s3_key IS NOT NULL AND s3_url IS NOT NULL AND image_url IS NULL) OR
    (image_url IS NOT NULL AND s3_key IS NULL AND s3_url IS NULL) OR
    (s3_key IS NULL AND s3_url IS NULL AND image_url IS NULL)
);

-- Step 5: Update RLS policies to work with S3 columns
-- Drop existing policies and recreate them to include S3 columns

-- Item images policies
DROP POLICY IF EXISTS "Users can view item images from their organization" ON item_images;
DROP POLICY IF EXISTS "Users can insert item images for their organization" ON item_images;
DROP POLICY IF EXISTS "Users can update item images from their organization" ON item_images;
DROP POLICY IF EXISTS "Users can delete item images from their organization" ON item_images;

-- Recreate policies with S3 support
CREATE POLICY "Users can view item images from their organization" ON item_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = item_images.organization_id
        )
    );

CREATE POLICY "Users can insert item images for their organization" ON item_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = item_images.organization_id
        )
        AND uploaded_by = auth.uid()
    );

CREATE POLICY "Users can update item images from their organization" ON item_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = item_images.organization_id
        )
    );

CREATE POLICY "Users can delete item images from their organization" ON item_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = item_images.organization_id
        )
    );

-- Sample images policies (if they don't exist)
DROP POLICY IF EXISTS "Users can view sample images from their organization" ON sample_images;
DROP POLICY IF EXISTS "Users can insert sample images for their organization" ON sample_images;
DROP POLICY IF EXISTS "Users can update sample images from their organization" ON sample_images;
DROP POLICY IF EXISTS "Users can delete sample images from their organization" ON sample_images;

-- Create policies for sample images if they don't exist
CREATE POLICY "Users can view sample images from their organization" ON sample_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM samples 
            JOIN profiles ON profiles.organization_id = samples.organization_id
            WHERE samples.id = sample_images.sample_id 
            AND profiles.id = auth.uid()
        )
    );

CREATE POLICY "Users can insert sample images for their organization" ON sample_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM samples 
            JOIN profiles ON profiles.organization_id = samples.organization_id
            WHERE samples.id = sample_images.sample_id 
            AND profiles.id = auth.uid()
        )
        AND uploaded_by = auth.uid()
    );

CREATE POLICY "Users can update sample images from their organization" ON sample_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM samples 
            JOIN profiles ON profiles.organization_id = samples.organization_id
            WHERE samples.id = sample_images.sample_id 
            AND profiles.id = auth.uid()
        )
    );

CREATE POLICY "Users can delete sample images from their organization" ON sample_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM samples 
            JOIN profiles ON profiles.organization_id = samples.organization_id
            WHERE samples.id = sample_images.sample_id 
            AND profiles.id = auth.uid()
        )
    );

-- Step 6: Add helpful comments
COMMENT ON COLUMN item_images.s3_key IS 'AWS S3 object key for the image file';
COMMENT ON COLUMN item_images.s3_url IS 'Full public URL for the image (S3 or CloudFront)';
COMMENT ON COLUMN sample_images.s3_key IS 'AWS S3 object key for the sample image file';
COMMENT ON COLUMN sample_images.s3_url IS 'Full public URL for the sample image (S3 or CloudFront)';

COMMIT;

-- Step 7: Optional data migration script (commented out)
-- Uncomment and modify if you need to migrate existing Supabase storage images to S3

/*
-- This would be a separate script to run after setting up S3
-- DO $$
-- DECLARE
--     image_record RECORD;
-- BEGIN
--     FOR image_record IN SELECT * FROM item_images WHERE storage_path IS NOT NULL AND s3_key IS NULL
--     LOOP
--         -- Logic to download from Supabase storage and upload to S3
--         -- This would require a custom function or external script
--         RAISE NOTICE 'Would migrate image %', image_record.id;
--     END LOOP;
-- END $$;
*/