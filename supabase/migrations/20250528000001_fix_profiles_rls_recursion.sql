-- Fix infinite recursion in profiles RLS policy
-- The issue is that any query to profiles table from within profiles RLS policy causes recursion
-- Solution: Use a function that bypasses RLS or restructure the policy

-- First, let's create a function that can safely get user's org ID without RLS issues
CREATE OR REPLACE FUNCTION public.get_user_organization_id_safe()
RETURNS uuid AS $$
DECLARE
    user_org_id uuid;
BEGIN
    -- Use a direct query with security definer to bypass RLS
    SELECT organization_id INTO user_org_id
    FROM public.profiles 
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN user_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the problematic policy
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;

-- Create a new policy that allows users to see their own profile and profiles in their org
-- We'll use a two-part approach: allow own profile + allow same org profiles
CREATE POLICY profiles_select_policy ON public.profiles 
  FOR SELECT 
  USING (
    -- Allow users to see their own profile (this doesn't cause recursion)
    id = auth.uid() 
    OR 
    -- Allow users to see profiles in their organization
    organization_id = public.get_user_organization_id_safe()
  );

COMMENT ON FUNCTION public.get_user_organization_id_safe IS 
'Safely gets user organization ID without causing RLS recursion. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON POLICY profiles_select_policy ON public.profiles IS 
'Allow users to see their own profile and all profiles in their organization. Uses safe function to avoid recursion.'; 