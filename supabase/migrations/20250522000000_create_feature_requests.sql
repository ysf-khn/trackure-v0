-- Migration: Create Feature Requests System
-- Purpose: This migration introduces a feature request system that allows users
--          to submit, vote on, and track feature requests for the application
-- Affected Tables:
--   - public.feature_requests: CREATE TABLE
--   - public.feature_request_votes: CREATE TABLE
-- Affected Functions:
--   - RLS policies for multi-tenancy support

-- Create feature_requests table
CREATE TABLE public.feature_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL CHECK (length(title) >= 3 AND length(title) <= 200),
    description text NOT NULL CHECK (length(description) >= 10 AND length(description) <= 2000),
    category text NOT NULL DEFAULT 'general' CHECK (
        category IN ('general', 'workflow', 'reporting', 'ui-ux', 'integration', 'performance', 'mobile')
    ),
    priority text NOT NULL DEFAULT 'medium' CHECK (
        priority IN ('low', 'medium', 'high', 'critical')
    ),
    status text NOT NULL DEFAULT 'submitted' CHECK (
        status IN ('submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected')
    ),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    vote_count integer NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
    admin_notes text,
    estimated_effort text CHECK (
        estimated_effort IS NULL OR estimated_effort IN ('small', 'medium', 'large', 'extra_large')
    ),
    target_release text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

-- Add comments to feature_requests table
COMMENT ON TABLE public.feature_requests IS 'Stores feature requests submitted by users within organizations.';
COMMENT ON COLUMN public.feature_requests.title IS 'Brief title of the feature request (3-200 characters).';
COMMENT ON COLUMN public.feature_requests.description IS 'Detailed description of the feature request (10-2000 characters).';
COMMENT ON COLUMN public.feature_requests.category IS 'Category to help organize feature requests.';
COMMENT ON COLUMN public.feature_requests.priority IS 'Priority level assigned by admins.';
COMMENT ON COLUMN public.feature_requests.status IS 'Current status of the feature request.';
COMMENT ON COLUMN public.feature_requests.vote_count IS 'Cached count of votes for performance.';
COMMENT ON COLUMN public.feature_requests.admin_notes IS 'Internal notes from administrators.';
COMMENT ON COLUMN public.feature_requests.estimated_effort IS 'Estimated development effort.';
COMMENT ON COLUMN public.feature_requests.target_release IS 'Target release version or date.';

-- Create feature_request_votes table
CREATE TABLE public.feature_request_votes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_request_id uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure one vote per user per feature request
    UNIQUE(feature_request_id, user_id)
);

-- Add comments to feature_request_votes table
COMMENT ON TABLE public.feature_request_votes IS 'Tracks user votes on feature requests.';
COMMENT ON COLUMN public.feature_request_votes.feature_request_id IS 'The feature request being voted on.';
COMMENT ON COLUMN public.feature_request_votes.user_id IS 'The user who cast the vote.';

-- Create indexes for performance
CREATE INDEX idx_feature_requests_organization_id ON public.feature_requests(organization_id);
CREATE INDEX idx_feature_requests_status ON public.feature_requests(status);
CREATE INDEX idx_feature_requests_category ON public.feature_requests(category);
CREATE INDEX idx_feature_requests_priority ON public.feature_requests(priority);
CREATE INDEX idx_feature_requests_vote_count ON public.feature_requests(vote_count DESC);
CREATE INDEX idx_feature_requests_created_at ON public.feature_requests(created_at DESC);
CREATE INDEX idx_feature_requests_submitted_by ON public.feature_requests(submitted_by);

CREATE INDEX idx_feature_request_votes_feature_request_id ON public.feature_request_votes(feature_request_id);
CREATE INDEX idx_feature_request_votes_user_id ON public.feature_request_votes(user_id);
CREATE INDEX idx_feature_request_votes_organization_id ON public.feature_request_votes(organization_id);

-- Enable Row Level Security
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_request_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_requests
-- Users can view feature requests in their organization
CREATE POLICY "Users can view feature requests in their organization" ON public.feature_requests
    FOR SELECT
    USING (organization_id = public.get_user_organization_id());

-- Users can create feature requests in their organization
CREATE POLICY "Users can create feature requests in their organization" ON public.feature_requests
    FOR INSERT
    WITH CHECK (
        organization_id = public.get_user_organization_id() 
        AND submitted_by = auth.uid()
    );

-- Users can update their own feature requests (title, description only)
CREATE POLICY "Users can update their own feature requests" ON public.feature_requests
    FOR UPDATE
    USING (
        organization_id = public.get_user_organization_id() 
        AND submitted_by = auth.uid()
    )
    WITH CHECK (
        organization_id = public.get_user_organization_id() 
        AND submitted_by = auth.uid()
    );

-- Only organization owners can delete feature requests
CREATE POLICY "Organization owners can delete feature requests" ON public.feature_requests
    FOR DELETE
    USING (
        organization_id = public.get_user_organization_id() 
        AND public.is_organization_owner()
    );

-- RLS Policies for feature_request_votes
-- Users can view votes in their organization
CREATE POLICY "Users can view votes in their organization" ON public.feature_request_votes
    FOR SELECT
    USING (organization_id = public.get_user_organization_id());

-- Users can create votes in their organization
CREATE POLICY "Users can create votes in their organization" ON public.feature_request_votes
    FOR INSERT
    WITH CHECK (
        organization_id = public.get_user_organization_id() 
        AND user_id = auth.uid()
    );

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes" ON public.feature_request_votes
    FOR DELETE
    USING (
        organization_id = public.get_user_organization_id() 
        AND user_id = auth.uid()
    );

-- Function to update vote count when votes are added/removed
CREATE OR REPLACE FUNCTION public.update_feature_request_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.feature_requests 
        SET vote_count = vote_count + 1,
            updated_at = now()
        WHERE id = NEW.feature_request_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.feature_requests 
        SET vote_count = vote_count - 1,
            updated_at = now()
        WHERE id = OLD.feature_request_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to automatically update vote counts
CREATE TRIGGER feature_request_vote_count_trigger
    AFTER INSERT OR DELETE ON public.feature_request_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feature_request_vote_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_feature_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER feature_request_updated_at_trigger
    BEFORE UPDATE ON public.feature_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feature_request_timestamp(); 