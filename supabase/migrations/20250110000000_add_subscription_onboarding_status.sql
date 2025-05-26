-- Drop the existing check constraint and add a new one with pending_subscription
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_onboarding_status_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_status_check CHECK (
    onboarding_status IN (
        'pending_subscription',
        'pending_profile',
        'pending_org',
        'pending_workflow',
        'pending_invites',
        'complete'
    )
);