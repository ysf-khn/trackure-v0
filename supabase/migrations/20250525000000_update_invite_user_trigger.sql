-- Update the function to handle invited users properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    initial_status text;
    user_org_id uuid;
    user_role text;
    user_full_name text;
BEGIN
    -- Check if this is an invited user (has organization_id in metadata)
    user_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    user_role := NEW.raw_user_meta_data->>'role';
    user_full_name := NEW.raw_user_meta_data->>'full_name';
    
    IF user_org_id IS NOT NULL AND user_role IS NOT NULL THEN
        -- This is an invited user - set them up with complete onboarding
        INSERT INTO public.profiles (id, organization_id, role, full_name, onboarding_status, created_at)
        VALUES (NEW.id, user_org_id, user_role, user_full_name, 'complete', now());
    ELSE
        -- This is a regular signup - determine initial onboarding status
        IF NEW.raw_user_meta_data->>'product_id' IS NULL THEN
            initial_status := 'pending_subscription';
        ELSE
            initial_status := 'pending_profile';
        END IF;
        
        INSERT INTO public.profiles (id, onboarding_status, created_at)
        VALUES (NEW.id, initial_status, now());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 'Handles new user signups, setting up profiles for both regular users and invited users with appropriate onboarding status'; 