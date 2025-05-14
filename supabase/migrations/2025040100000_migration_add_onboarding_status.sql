-- Add onboarding_status column to profiles table
ALTER TABLE public.profiles
ADD COLUMN onboarding_status text NULL DEFAULT 'pending_profile' CHECK (
    onboarding_status IN (
        'pending_profile',
        'pending_org',
        'pending_workflow',
        'pending_invites',
        'complete'
    )
);

COMMENT ON COLUMN public.profiles.onboarding_status IS 'Tracks the user''s progress through the initial onboarding flow.';