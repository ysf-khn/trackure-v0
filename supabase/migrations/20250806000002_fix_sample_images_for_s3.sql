-- Migration: Fix sample_images table for S3 integration
-- This migration fixes missing organization_id and RLS policies for sample images

BEGIN;

-- Step 1: Add organization_id to sample_images table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sample_images' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE sample_images 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        -- Populate organization_id from the related sample
        UPDATE sample_images 
        SET organization_id = samples.organization_id
        FROM samples 
        WHERE sample_images.sample_id = samples.id;
        
        -- Make it NOT NULL after populating
        ALTER TABLE sample_images 
        ALTER COLUMN organization_id SET NOT NULL;
        
        -- Add index for performance
        CREATE INDEX idx_sample_images_organization ON sample_images(organization_id);
    END IF;
END $$;

-- Step 2: Ensure uploaded_by column exists and has proper type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sample_images' 
        AND column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE sample_images 
        ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Step 3: Drop the problematic constraint and recreate it properly
ALTER TABLE sample_images DROP CONSTRAINT IF EXISTS check_sample_image_storage;

-- Add improved constraint for sample images
ALTER TABLE sample_images 
ADD CONSTRAINT check_sample_image_storage CHECK (
    (s3_key IS NOT NULL AND s3_url IS NOT NULL) OR
    (image_url IS NOT NULL) OR
    (s3_key IS NULL AND s3_url IS NULL AND image_url IS NULL)
);

-- Step 4: Enable RLS on sample_images if not already enabled
ALTER TABLE sample_images ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies and recreate them
DROP POLICY IF EXISTS "Users can view sample images from their organization" ON sample_images;
DROP POLICY IF EXISTS "Users can insert sample images for their organization" ON sample_images;
DROP POLICY IF EXISTS "Users can update sample images from their organization" ON sample_images;
DROP POLICY IF EXISTS "Users can delete sample images from their organization" ON sample_images;

-- Create comprehensive RLS policies for sample_images
CREATE POLICY "Users can view sample images from their organization" ON sample_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = sample_images.organization_id
        )
    );

CREATE POLICY "Users can insert sample images for their organization" ON sample_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = sample_images.organization_id
        )
        AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
    );

CREATE POLICY "Users can update sample images from their organization" ON sample_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = sample_images.organization_id
        )
    );

CREATE POLICY "Users can delete sample images from their organization" ON sample_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = sample_images.organization_id
        )
    );

-- Step 6: Add helpful comments
COMMENT ON COLUMN sample_images.organization_id IS 'Organization ID for RLS policy enforcement';
COMMENT ON COLUMN sample_images.s3_key IS 'AWS S3 object key for the sample image file';
COMMENT ON COLUMN sample_images.s3_url IS 'Full public URL for the sample image (S3 or CloudFront)';
COMMENT ON COLUMN sample_images.uploaded_by IS 'User who uploaded the image';

-- Step 7: Create helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_sample_images_sample_id ON sample_images(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_images_uploaded_by ON sample_images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_sample_images_s3_key ON sample_images(s3_key) WHERE s3_key IS NOT NULL;

COMMIT;