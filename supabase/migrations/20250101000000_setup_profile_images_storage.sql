-- Migration to set up storage policies for profile-images bucket
-- Create the bucket if it doesn't exist (you can skip this if you already created it manually)
INSERT INTO
    storage.buckets (id, name, public)
VALUES
    ('profile-images', 'profile-images', true) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload profile images
CREATE POLICY "Allow authenticated users to upload profile images" ON storage.objects FOR INSERT
WITH
    CHECK (
        bucket_id = 'profile-images'
        AND auth.role () = 'authenticated'
    );

-- Policy to allow public read access to profile images
CREATE POLICY "Allow public read access to profile images" ON storage.objects FOR
SELECT
    USING (bucket_id = 'profile-images');

-- Policy to allow authenticated users to update their own profile images
CREATE POLICY "Allow authenticated users to update profile images" ON storage.objects FOR
UPDATE USING (
    bucket_id = 'profile-images'
    AND auth.role () = 'authenticated'
)
WITH
    CHECK (
        bucket_id = 'profile-images'
        AND auth.role () = 'authenticated'
    );

-- Policy to allow authenticated users to delete their own profile images
CREATE POLICY "Allow authenticated users to delete profile images" ON storage.objects FOR DELETE USING (
    bucket_id = 'profile-images'
    AND auth.role () = 'authenticated'
);