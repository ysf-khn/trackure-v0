-- Create a function to handle new user signups
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
    
    INSERT INTO public.profiles (id, onboarding_status)
    VALUES (NEW.id, initial_status);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create a profile when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to sync profile onboarding status with user metadata
-- This helps fix any users who might be in an inconsistent state (e.g., Google OAuth users)
CREATE OR REPLACE FUNCTION public.sync_profile_onboarding_status()
RETURNS void AS $$
BEGIN
    -- Update profiles where user has product_id but profile status is still pending_subscription
    UPDATE public.profiles 
    SET onboarding_status = 'pending_profile'
    FROM auth.users
    WHERE profiles.id = auth.users.id
    AND profiles.onboarding_status = 'pending_subscription'
    AND auth.users.raw_user_meta_data->>'product_id' IS NOT NULL
    AND profiles.onboarding_status != 'complete';
    
    RAISE NOTICE 'Synced profile onboarding status for users with product_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the sync function to fix any existing inconsistent states
SELECT public.sync_profile_onboarding_status(); 