-- Fix organizations RLS policy to prevent join issues
-- The issue is that Workers can't access organization data in joins because
-- the RLS policy uses get_user_organization_id() which can cause circular dependency issues
-- Solution: Use the safe function that bypasses RLS
-- Drop the existing policy
DROP POLICY IF EXISTS organizations_select_policy ON public.organizations;

-- Create a new policy using the safe function
CREATE POLICY organizations_select_policy ON public.organizations FOR
SELECT
    USING (id = public.get_user_organization_id_safe ());

COMMENT ON POLICY organizations_select_policy ON public.organizations IS 'Allow users to see their own organization. Uses safe function to avoid RLS recursion issues in joins.';