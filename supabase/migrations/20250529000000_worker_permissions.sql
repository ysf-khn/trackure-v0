-- Create worker_permissions table to store granular permissions for workers
CREATE TABLE public.worker_permissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    permission_key text NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, permission_key)
);

COMMENT ON TABLE public.worker_permissions IS 'Stores granular permissions for workers in each organization';
COMMENT ON COLUMN public.worker_permissions.permission_key IS 'Dot-notation permission key (e.g., workflow.edit, items.delete)';
COMMENT ON COLUMN public.worker_permissions.enabled IS 'Whether this permission is enabled for workers in this organization';

-- Enable RLS
ALTER TABLE public.worker_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for worker_permissions
-- Select: Users can see permissions for their organization
CREATE POLICY worker_permissions_select_policy ON public.worker_permissions 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Only Owners can create permission settings
CREATE POLICY worker_permissions_insert_policy ON public.worker_permissions 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Update: Only Owners can update permission settings
CREATE POLICY worker_permissions_update_policy ON public.worker_permissions 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Delete: Only Owners can delete permission settings
CREATE POLICY worker_permissions_delete_policy ON public.worker_permissions 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Create function to check if a worker has a specific permission
CREATE OR REPLACE FUNCTION public.worker_has_permission(permission_key text)
RETURNS boolean AS $$
DECLARE
  user_role text;
  org_id uuid;
  permission_enabled boolean;
BEGIN
  -- Get user role and organization
  SELECT role, organization_id INTO user_role, org_id
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Owners always have all permissions
  IF user_role = 'Owner' THEN
    RETURN true;
  END IF;
  
  -- For workers, check the specific permission
  IF user_role = 'Worker' THEN
    SELECT enabled INTO permission_enabled
    FROM public.worker_permissions
    WHERE organization_id = org_id AND permission_key = worker_has_permission.permission_key;
    
    -- If permission not found, default to false
    RETURN COALESCE(permission_enabled, false);
  END IF;
  
  -- Default deny for unknown roles
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all permissions for current user's organization
CREATE OR REPLACE FUNCTION public.get_worker_permissions()
RETURNS TABLE(permission_key text, enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT wp.permission_key, wp.enabled
  FROM public.worker_permissions wp
  WHERE wp.organization_id = public.get_user_organization_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default permissions for existing organizations
INSERT INTO public.worker_permissions (organization_id, permission_key, enabled)
SELECT 
  o.id,
  permission_key,
  CASE 
    WHEN permission_key IN ('workflow.view', 'items.view', 'items.move', 'items.add', 'orders.view', 'orders.create', 'documents.vouchers', 'documents.history', 'team.view') THEN true
    ELSE false
  END as enabled
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('workflow.view'),
    ('workflow.edit'),
    ('items.view'),
    ('items.move'),
    ('items.add'),
    ('items.delete'),
    ('orders.view'),
    ('orders.create'),
    ('orders.edit'),
    ('orders.payment_status'),
    ('documents.vouchers'),
    ('documents.history'),
    ('documents.export'),
    ('team.view'),
    ('team.invite'),
    ('team.edit'),
    ('team.remove'),
    ('settings.account'),
    ('settings.billing'),
    ('settings.organization')
) AS permissions(permission_key)
ON CONFLICT (organization_id, permission_key) DO NOTHING; 