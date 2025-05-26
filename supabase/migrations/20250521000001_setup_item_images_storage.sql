-- Migration to set up storage policies for item-images bucket
-- Create the bucket if it doesn't exist
INSERT INTO
    storage.buckets (id, name, public)
VALUES
    ('item-images', 'item-images', true) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload item images
-- Only users within the same organization can upload
CREATE POLICY "Allow authenticated users to upload item images" ON storage.objects FOR INSERT
WITH
    CHECK (
        bucket_id = 'item-images'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = (
            SELECT organization_id::text 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy to allow public read access to item images
-- This allows the images to be displayed without authentication
CREATE POLICY "Allow public read access to item images" ON storage.objects FOR
SELECT
    USING (bucket_id = 'item-images');

-- Policy to allow authenticated users to update item images within their organization
CREATE POLICY "Allow authenticated users to update item images" ON storage.objects FOR
UPDATE USING (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
        SELECT organization_id::text 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
)
WITH
    CHECK (
        bucket_id = 'item-images'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = (
            SELECT organization_id::text 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy to allow authenticated users to delete item images within their organization
CREATE POLICY "Allow authenticated users to delete item images" ON storage.objects FOR DELETE USING (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
        SELECT organization_id::text 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
); 