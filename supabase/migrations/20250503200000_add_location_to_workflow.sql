-- Add location column to workflow_stages table
ALTER TABLE public.workflow_stages
ADD COLUMN location text;

COMMENT ON COLUMN public.workflow_stages.location IS 'Optional physical location where this stage takes place.';

-- Add location column to workflow_sub_stages table
ALTER TABLE public.workflow_sub_stages
ADD COLUMN location text;

COMMENT ON COLUMN public.workflow_sub_stages.location IS 'Optional physical location where this sub-stage takes place.';