-- Fix the worker_has_permission function to resolve ambiguous column reference
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
    WHERE organization_id = org_id AND worker_permissions.permission_key = worker_has_permission.permission_key;
    
    -- If permission not found, default to false
    RETURN COALESCE(permission_enabled, false);
  END IF;
  
  -- Default deny for unknown roles
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 