-- Enable Row Level Security for all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_sub_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_stage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_movement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;

-- Create a helper function to get a user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid AS $$
  SELECT organization_id 
  FROM public.profiles 
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Create a helper function to check if a user is an Owner in their organization
CREATE OR REPLACE FUNCTION public.is_organization_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Owner'
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Organizations Table Policies
-- Select: Users can see their own organization
CREATE POLICY organizations_select_policy ON public.organizations 
  FOR SELECT 
  USING (id = public.get_user_organization_id());

-- Insert: Only authenticated users with Owner role can create organizations
CREATE POLICY organizations_insert_policy ON public.organizations 
  FOR INSERT 
  WITH CHECK (public.is_organization_owner());

-- Update: Only authenticated users with Owner role can update their organization
CREATE POLICY organizations_update_policy ON public.organizations 
  FOR UPDATE 
  USING (id = public.get_user_organization_id() AND public.is_organization_owner());

-- Delete: Only authenticated users with Owner role can delete their organization
CREATE POLICY organizations_delete_policy ON public.organizations 
  FOR DELETE 
  USING (id = public.get_user_organization_id() AND public.is_organization_owner());

-- Profiles Table Policies
-- Select: Users can see profiles in their organization
CREATE POLICY profiles_select_policy ON public.profiles 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Only authenticated users with Owner role can add profiles to their organization
CREATE POLICY profiles_insert_policy ON public.profiles 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Update: Users can update their own profile, Owners can update any profile in their organization
CREATE POLICY profiles_update_policy ON public.profiles 
  FOR UPDATE 
  USING ((id = auth.uid()) OR 
         (organization_id = public.get_user_organization_id() AND public.is_organization_owner()));

-- Delete: Only Owners can delete profiles in their organization
CREATE POLICY profiles_delete_policy ON public.profiles 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Workflow Stages Table Policies
-- Select: Users can see workflow stages in their organization and default stages
CREATE POLICY workflow_stages_select_policy ON public.workflow_stages 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id() OR organization_id IS NULL);

-- Insert: Only Owners can add workflow stages to their organization
CREATE POLICY workflow_stages_insert_policy ON public.workflow_stages 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Update: Only Owners can update workflow stages in their organization
CREATE POLICY workflow_stages_update_policy ON public.workflow_stages 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Delete: Only Owners can delete workflow stages in their organization
CREATE POLICY workflow_stages_delete_policy ON public.workflow_stages 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Workflow Sub-Stages Table Policies
-- Select: Users can see workflow sub-stages in their organization and default sub-stages
CREATE POLICY workflow_sub_stages_select_policy ON public.workflow_sub_stages 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id() OR organization_id IS NULL);

-- Insert: Only Owners can add workflow sub-stages to their organization
CREATE POLICY workflow_sub_stages_insert_policy ON public.workflow_sub_stages 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Update: Only Owners can update workflow sub-stages in their organization
CREATE POLICY workflow_sub_stages_update_policy ON public.workflow_sub_stages 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Delete: Only Owners can delete workflow sub-stages in their organization
CREATE POLICY workflow_sub_stages_delete_policy ON public.workflow_sub_stages 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Orders Table Policies
-- Select: Users can see orders in their organization
CREATE POLICY orders_select_policy ON public.orders 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Authenticated users can add orders to their organization
CREATE POLICY orders_insert_policy ON public.orders 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Update: Authenticated users can update orders in their organization
CREATE POLICY orders_update_policy ON public.orders 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id());

-- Delete: Only Owners can delete orders in their organization
CREATE POLICY orders_delete_policy ON public.orders 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Item Master Table Policies
-- Select: Users can see item masters in their organization
CREATE POLICY item_master_select_policy ON public.item_master 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Authenticated users can add item masters to their organization
CREATE POLICY item_master_insert_policy ON public.item_master 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Update: Authenticated users can update item masters in their organization
CREATE POLICY item_master_update_policy ON public.item_master 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id());

-- Delete: Only Owners can delete item masters in their organization
CREATE POLICY item_master_delete_policy ON public.item_master 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Items Table Policies
-- Select: Users can see items in their organization
CREATE POLICY items_select_policy ON public.items 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Authenticated users can add items to their organization
CREATE POLICY items_insert_policy ON public.items 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Update: Authenticated users can update items in their organization
CREATE POLICY items_update_policy ON public.items 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id());

-- Delete: Only Owners can delete items in their organization
CREATE POLICY items_delete_policy ON public.items 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Item Stage Allocations Table Policies
-- Select: Users can see item stage allocations in their organization
CREATE POLICY item_stage_allocations_select_policy ON public.item_stage_allocations 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Authenticated users can add item stage allocations to their organization
CREATE POLICY item_stage_allocations_insert_policy ON public.item_stage_allocations 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Update: Authenticated users can update item stage allocations in their organization
CREATE POLICY item_stage_allocations_update_policy ON public.item_stage_allocations 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id());

-- Delete: Only Owners can delete item stage allocations in their organization
CREATE POLICY item_stage_allocations_delete_policy ON public.item_stage_allocations 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Item Movement History Table Policies
-- Select: Users can see item movement history in their organization
CREATE POLICY item_movement_history_select_policy ON public.item_movement_history 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Authenticated users can add item movement history to their organization
CREATE POLICY item_movement_history_insert_policy ON public.item_movement_history 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Update: Item movement history should generally not be updated, but if needed, only by Owners
CREATE POLICY item_movement_history_update_policy ON public.item_movement_history 
  FOR UPDATE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Delete: Only Owners can delete item movement history in their organization
CREATE POLICY item_movement_history_delete_policy ON public.item_movement_history 
  FOR DELETE 
  USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- Remarks Table Policies
-- Select: Users can see remarks in their organization
CREATE POLICY remarks_select_policy ON public.remarks 
  FOR SELECT 
  USING (organization_id = public.get_user_organization_id());

-- Insert: Authenticated users can add remarks to their organization
CREATE POLICY remarks_insert_policy ON public.remarks 
  FOR INSERT 
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Update: Users can update their own remarks, Owners can update any remark in their organization
CREATE POLICY remarks_update_policy ON public.remarks 
  FOR UPDATE 
  USING ((user_id = auth.uid()) OR 
         (organization_id = public.get_user_organization_id() AND public.is_organization_owner()));

-- Delete: Users can delete their own remarks, Owners can delete any remark in their organization
CREATE POLICY remarks_delete_policy ON public.remarks 
  FOR DELETE 
  USING ((user_id = auth.uid()) OR 
         (organization_id = public.get_user_organization_id() AND public.is_organization_owner()));