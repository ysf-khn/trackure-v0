-- Fix item_images table to allow S3-only records
-- Remove NOT NULL constraint from storage_path to enable S3 migration

BEGIN;

-- Step 1: Remove the NOT NULL constraint from storage_path column
-- This allows records to have NULL storage_path when using S3
ALTER TABLE item_images 
ALTER COLUMN storage_path DROP NOT NULL;

-- Step 2: Verify the CHECK constraint from the previous migration is correct
-- The existing constraint should already allow S3-only records, but let's make sure it's properly defined
ALTER TABLE item_images DROP CONSTRAINT IF EXISTS check_image_storage;

-- Recreate the constraint with clear logic:
-- Allow either: S3 fields populated with NULL storage_path, OR legacy storage_path with NULL S3 fields, OR all NULL
ALTER TABLE item_images 
ADD CONSTRAINT check_image_storage CHECK (
    -- S3 storage: both s3_key and s3_url must be present, storage_path must be NULL
    (s3_key IS NOT NULL AND s3_url IS NOT NULL AND storage_path IS NULL) OR
    -- Legacy storage: storage_path must be present, S3 fields must be NULL  
    (storage_path IS NOT NULL AND s3_key IS NULL AND s3_url IS NULL) OR
    -- No storage: all fields are NULL (for records that haven't been uploaded yet)
    (s3_key IS NULL AND s3_url IS NULL AND storage_path IS NULL)
);

-- Step 3: Add helpful comment
COMMENT ON CONSTRAINT check_image_storage ON item_images IS 
'Ensures either S3 storage (s3_key + s3_url) or legacy storage (storage_path) is used, but not both';

COMMIT;