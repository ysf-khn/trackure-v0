-- Migration: Fix Onboarding Issues
-- Purpose: This migration fixes two critical onboarding issues:
--          1. New signups should have 'Owner' role by default, not 'Worker'
--          2. RLS policy prevents workflow stage creation during org setup
-- Issues Fixed:
--   - Issue #1: New signups get Worker role instead of Owner
--   - Issue #2: RLS error when creating completed stage during org setup

-- Fix 1: Update the default role for profiles table to 'Owner'
-- This affects new records only - existing records are updated separately
ALTER TABLE public.profiles 
ALTER COLUMN role SET DEFAULT 'Owner';

-- Fix 2: Update existing users who created organizations but have Worker role
-- These are likely users who signed up and created orgs but got stuck with Worker role
UPDATE public.profiles 
SET role = 'Owner'
WHERE id IN (
    SELECT DISTINCT p.id 
    FROM public.profiles p
    INNER JOIN public.organizations o ON p.organization_id = o.id
    WHERE p.role = 'Worker'
    AND p.onboarding_status IN ('pending_workflow', 'complete')
);

-- Fix 3: Create a proper transaction function for organization creation
-- This ensures the user is set as Owner BEFORE the organization is created
-- so that the RLS policies work correctly when the trigger runs
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    p_user_id uuid,
    p_organization_name text
)
RETURNS uuid AS $$
DECLARE
    v_organization_id uuid;
BEGIN
    -- Start a transaction block
    BEGIN
        -- First, update the user's role to Owner (this should work since it's their own profile)
        UPDATE public.profiles 
        SET role = 'Owner', onboarding_status = 'pending_workflow'
        WHERE id = p_user_id;
        
        -- Check if the update worked
        IF NOT FOUND THEN
            RAISE EXCEPTION 'User profile not found or could not be updated';
        END IF;
        
        -- Now create the organization
        INSERT INTO public.organizations (name)
        VALUES (p_organization_name)
        RETURNING id INTO v_organization_id;
        
        -- Finally, update the user's organization_id
        UPDATE public.profiles 
        SET organization_id = v_organization_id
        WHERE id = p_user_id;
        
        -- Check if the update worked
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Could not assign user to organization';
        END IF;
        
        RETURN v_organization_id;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Re-raise the exception to rollback the transaction
            RAISE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(uuid, text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.create_organization_with_owner IS 'Creates an organization and assigns the user as its owner in a single transaction, ensuring proper RLS policy evaluation';

-- Fix 4: Create completed stages for any organizations that might be missing them
-- This helps fix any organizations created during the problematic period
DO $$
DECLARE
    org_record RECORD;
    stage_count INTEGER;
BEGIN
    FOR org_record IN SELECT id FROM public.organizations LOOP
        -- Check if completed stage exists
        SELECT COUNT(*) INTO stage_count
        FROM public.workflow_stages
        WHERE organization_id = org_record.id 
        AND name = 'Completed'
        AND is_default = false;
        
        -- Create if missing
        IF stage_count = 0 THEN
            PERFORM public.create_completed_stage_for_organization(org_record.id);
            RAISE NOTICE 'Created missing Completed stage for organization %', org_record.id;
        END IF;
    END LOOP;
END $$; 