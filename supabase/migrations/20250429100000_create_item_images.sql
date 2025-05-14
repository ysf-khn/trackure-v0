-- Migration to create the item_images table and set up RLS policies

-- Create the item_images table
CREATE TABLE public.item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL, -- Denormalized for RLS/querying
  storage_path TEXT NOT NULL UNIQUE, -- Path within the Supabase bucket (should be unique)
  file_name TEXT,
  file_size_bytes BIGINT,
  content_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Keep record even if user deleted
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  remark_id BIGINT REFERENCES public.remarks(id) ON DELETE SET NULL, -- Optional: Link to a specific remark

  -- Optional: Add foreign key constraint to organizations if it exists and is useful
  -- CONSTRAINT fk_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE

  -- Constraints
  CONSTRAINT check_storage_path_format CHECK (storage_path ~ E'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.*') -- Basic check for org_id/path format
);

-- Add comments to columns
COMMENT ON COLUMN public.item_images.storage_path IS 'Full path to the image file within the item-images Supabase Storage bucket.';
COMMENT ON COLUMN public.item_images.remark_id IS 'Optional foreign key linking the image to a specific remark.';

-- Create indexes for common query patterns
CREATE INDEX idx_item_images_item_id ON public.item_images(item_id);
CREATE INDEX idx_item_images_organization_id ON public.item_images(organization_id);
CREATE INDEX idx_item_images_remark_id ON public.item_images(remark_id);
CREATE INDEX idx_item_images_uploaded_by ON public.item_images(uploaded_by);

-- Enable Row Level Security (RLS)
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for item_images

-- Allow users to read images belonging to their organization
CREATE POLICY "Allow read access to users within the organization" ON public.item_images
FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) -- Check against profiles table
);

-- Allow authenticated users to insert images for their organization
CREATE POLICY "Allow insert access to users within the organization" ON public.item_images
FOR INSERT
WITH CHECK (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND -- Check against profiles table
  uploaded_by = auth.uid()
);

-- Allow users (or maybe just owners) to delete images they uploaded within their organization
-- Option 1: Allow uploader to delete
CREATE POLICY "Allow uploader to delete their own images" ON public.item_images
FOR DELETE
USING (
  uploaded_by = auth.uid() AND
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) -- Check against profiles table
);

-- Option 2 (Alternative/Additional): Allow organization owners to delete any image in their org
-- CREATE POLICY "Allow organization owners to delete images" ON public.item_images
-- FOR DELETE
-- USING (
--   organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
--   EXISTS (
--     SELECT 1 FROM public.profiles
--     WHERE id = auth.uid() AND role = 'Owner' AND profiles.organization_id = item_images.organization_id
--   )
-- );