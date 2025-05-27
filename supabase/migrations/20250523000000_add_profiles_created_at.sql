-- Add created_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN created_at timestamptz;

-- Set created_at to updated_at for existing records (best approximation we have)
UPDATE public.profiles 
SET created_at = updated_at 
WHERE created_at IS NULL;

-- Make created_at NOT NULL and set default
ALTER TABLE public.profiles 
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN created_at SET DEFAULT now();

-- Update the trigger function to set created_at for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    initial_status text;
BEGIN
    -- Determine initial onboarding status based on user metadata
    IF NEW.raw_user_meta_data->>'product_id' IS NULL THEN
        initial_status := 'pending_subscription';
    ELSE
        initial_status := 'pending_profile';
    END IF;
    
    INSERT INTO public.profiles (id, onboarding_status, created_at)
    VALUES (NEW.id, initial_status, now());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp when the user profile was created (when user joined the platform).'; 