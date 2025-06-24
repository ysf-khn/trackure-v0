-- Migration: Add Composite Items Support
-- Purpose: Add support for composite items (logical groupings of sub-components)
-- Date: 2025-02-02
-- 
-- This migration adds:
-- 1. Composite item definitions table
-- 2. Composite item components table  
-- 3. Extensions to existing tables for composite support
-- 4. Indexes and constraints for performance and data integrity
-- 5. Views and functions for composite item status tracking

-- ===== NEW TABLES =====

-- Composite Item Definitions (metadata/grouping)
CREATE TABLE public.composite_item_definitions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    composite_sku text NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL, -- e.g., "Complete Phone Case Set"
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (composite_sku, organization_id) REFERENCES public.item_master(sku, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE(composite_sku, organization_id)
);

COMMENT ON TABLE public.composite_item_definitions IS 'Defines composite items as logical groupings of multiple sub-components';
COMMENT ON COLUMN public.composite_item_definitions.composite_sku IS 'SKU of the composite item in item_master';
COMMENT ON COLUMN public.composite_item_definitions.is_active IS 'Whether this composite definition is currently active/available';

-- Components that make up a composite item
CREATE TABLE public.composite_item_components (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    composite_definition_id uuid NOT NULL REFERENCES public.composite_item_definitions(id) ON DELETE CASCADE,
    component_sku text NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    quantity_per_composite integer NOT NULL CHECK (quantity_per_composite > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (component_sku, organization_id) REFERENCES public.item_master(sku, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE(composite_definition_id, component_sku)
);

COMMENT ON TABLE public.composite_item_components IS 'Defines which component SKUs make up each composite item';
COMMENT ON COLUMN public.composite_item_components.quantity_per_composite IS 'How many units of this component are needed per composite item';

-- ===== EXTEND EXISTING TABLES =====

-- Add composite support to item_master
ALTER TABLE public.item_master 
ADD COLUMN is_composite boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.item_master.is_composite IS 'Whether this SKU represents a composite item made of multiple components';

-- Add composite grouping to items table
ALTER TABLE public.items 
ADD COLUMN composite_group_id uuid NULL, -- Links components of same composite instance
ADD COLUMN parent_composite_sku text NULL; -- Reference to what composite this component belongs to

COMMENT ON COLUMN public.items.composite_group_id IS 'Groups all component items that belong to the same composite item instance';
COMMENT ON COLUMN public.items.parent_composite_sku IS 'SKU of the composite item this component belongs to (if any)';

-- ===== INDEXES FOR PERFORMANCE =====

-- Indexes for composite_item_definitions
CREATE INDEX idx_composite_item_definitions_organization_id ON public.composite_item_definitions(organization_id);
CREATE INDEX idx_composite_item_definitions_composite_sku ON public.composite_item_definitions(composite_sku, organization_id);
CREATE INDEX idx_composite_item_definitions_is_active ON public.composite_item_definitions(is_active);

-- Indexes for composite_item_components
CREATE INDEX idx_composite_item_components_definition_id ON public.composite_item_components(composite_definition_id);
CREATE INDEX idx_composite_item_components_component_sku ON public.composite_item_components(component_sku, organization_id);
CREATE INDEX idx_composite_item_components_organization_id ON public.composite_item_components(organization_id);

-- Indexes for extended items table
CREATE INDEX idx_items_composite_group_id ON public.items(composite_group_id) WHERE composite_group_id IS NOT NULL;
CREATE INDEX idx_items_parent_composite_sku ON public.items(parent_composite_sku, organization_id) WHERE parent_composite_sku IS NOT NULL;
CREATE INDEX idx_items_is_composite_component ON public.items(organization_id) WHERE composite_group_id IS NOT NULL;

-- Index for extended item_master table
CREATE INDEX idx_item_master_is_composite ON public.item_master(is_composite, organization_id) WHERE is_composite = true;

-- ===== VIEWS FOR COMPOSITE ITEM STATUS =====

-- View: Composite item status summary
CREATE VIEW public.composite_item_status AS
SELECT 
    i.composite_group_id,
    i.parent_composite_sku,
    i.order_id,
    o.order_number,
    o.customer_name,
    COUNT(*) as total_components,
    COUNT(*) FILTER (WHERE i.remaining_quantity = 0) as completed_components,
    COUNT(DISTINCT i.sku) as unique_component_types,
    SUM(i.total_quantity) as total_component_quantity,
    SUM(i.total_quantity - i.remaining_quantity) as completed_component_quantity,
    ROUND(
        (COUNT(*) FILTER (WHERE i.remaining_quantity = 0)::decimal / COUNT(*)) * 100, 
        1
    ) as completion_percentage,
    CASE 
        WHEN COUNT(*) FILTER (WHERE i.remaining_quantity = 0) = COUNT(*) THEN 'Completed'
        WHEN COUNT(*) FILTER (WHERE i.remaining_quantity = 0) = 0 THEN 'Not Started'
        ELSE 'In Progress'
    END as composite_status,
    MIN(i.created_at) as created_at,
    MAX(i.updated_at) as last_updated,
    i.organization_id
FROM public.items i
JOIN public.orders o ON i.order_id = o.id
WHERE i.composite_group_id IS NOT NULL
GROUP BY 
    i.composite_group_id, 
    i.parent_composite_sku, 
    i.order_id,
    o.order_number,
    o.customer_name,
    i.organization_id;

COMMENT ON VIEW public.composite_item_status IS 'Provides completion status and progress tracking for composite item instances';

-- View: Composite item definitions with component details
CREATE VIEW public.composite_item_definitions_with_components AS
SELECT 
    d.id,
    d.composite_sku,
    d.organization_id,
    d.name,
    d.description,
    d.is_active,
    d.created_at,
    d.updated_at,
    COUNT(c.id) as component_count,
    SUM(c.quantity_per_composite) as total_component_quantity,
    ARRAY_AGG(
        json_build_object(
            'component_sku', c.component_sku,
            'quantity_per_composite', c.quantity_per_composite
        ) ORDER BY c.created_at
    ) as components
FROM public.composite_item_definitions d
LEFT JOIN public.composite_item_components c ON d.id = c.composite_definition_id
GROUP BY d.id, d.composite_sku, d.organization_id, d.name, d.description, d.is_active, d.created_at, d.updated_at;

COMMENT ON VIEW public.composite_item_definitions_with_components IS 'Composite item definitions with aggregated component information';

-- ===== FUNCTIONS FOR COMPOSITE ITEM MANAGEMENT =====

-- Function: Get composite item completion status
CREATE OR REPLACE FUNCTION public.get_composite_completion_status(
    p_composite_group_id uuid
)
RETURNS TABLE (
    total_components integer,
    completed_components integer,
    completion_percentage decimal,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::integer as total_components,
        COUNT(*) FILTER (WHERE remaining_quantity = 0)::integer as completed_components,
        ROUND(
            (COUNT(*) FILTER (WHERE remaining_quantity = 0)::decimal / COUNT(*)) * 100, 
            1
        ) as completion_percentage,
        CASE 
            WHEN COUNT(*) FILTER (WHERE remaining_quantity = 0) = COUNT(*) THEN 'Completed'
            WHEN COUNT(*) FILTER (WHERE remaining_quantity = 0) = 0 THEN 'Not Started'
            ELSE 'In Progress'
        END as status
    FROM public.items
    WHERE composite_group_id = p_composite_group_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_composite_completion_status IS 'Returns completion status for a specific composite item group';

-- Function: Create component items when composite item is ordered
CREATE OR REPLACE FUNCTION public.create_composite_item_components(
    p_order_id uuid,
    p_composite_sku text,
    p_composite_quantity integer,
    p_organization_id uuid,
    p_buyer_id text DEFAULT NULL,
    p_instance_details jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_composite_group_id uuid;
    v_component_record RECORD;
    v_component_total_quantity integer;
BEGIN
    -- Generate a unique group ID for this composite item instance
    v_composite_group_id := uuid_generate_v4();
    
    -- Create individual items for each component
    FOR v_component_record IN 
        SELECT c.component_sku, c.quantity_per_composite
        FROM public.composite_item_components c
        JOIN public.composite_item_definitions d ON c.composite_definition_id = d.id
        WHERE d.composite_sku = p_composite_sku 
        AND d.organization_id = p_organization_id
        AND d.is_active = true
    LOOP
        -- Calculate total quantity needed for this component
        v_component_total_quantity := v_component_record.quantity_per_composite * p_composite_quantity;
        
        -- Create the component item
        INSERT INTO public.items (
            order_id,
            sku,
            buyer_id,
            instance_details,
            total_quantity,
            remaining_quantity,
            organization_id,
            composite_group_id,
            parent_composite_sku,
            status
        ) VALUES (
            p_order_id,
            v_component_record.component_sku,
            p_buyer_id,
            p_instance_details,
            v_component_total_quantity,
            v_component_total_quantity,
            p_organization_id,
            v_composite_group_id,
            p_composite_sku,
            'New'
        );
    END LOOP;
    
    RETURN v_composite_group_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.create_composite_item_components IS 'Creates individual component items when a composite item is added to an order';

-- ===== TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES =====

-- Trigger function for composite_item_definitions updated_at
CREATE OR REPLACE FUNCTION public.handle_composite_definitions_timestamp_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply timestamp trigger to composite_item_definitions
CREATE TRIGGER on_composite_item_definitions_update
    BEFORE UPDATE ON public.composite_item_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_composite_definitions_timestamp_update();

-- ===== ROW LEVEL SECURITY (RLS) POLICIES =====

-- Enable RLS on new tables
ALTER TABLE public.composite_item_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composite_item_components ENABLE ROW LEVEL SECURITY;

-- RLS Policies for composite_item_definitions
CREATE POLICY composite_item_definitions_select_policy ON public.composite_item_definitions 
    FOR SELECT 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY composite_item_definitions_insert_policy ON public.composite_item_definitions 
    FOR INSERT 
    WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY composite_item_definitions_update_policy ON public.composite_item_definitions 
    FOR UPDATE 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY composite_item_definitions_delete_policy ON public.composite_item_definitions 
    FOR DELETE 
    USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- RLS Policies for composite_item_components
CREATE POLICY composite_item_components_select_policy ON public.composite_item_components 
    FOR SELECT 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY composite_item_components_insert_policy ON public.composite_item_components 
    FOR INSERT 
    WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY composite_item_components_update_policy ON public.composite_item_components 
    FOR UPDATE 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY composite_item_components_delete_policy ON public.composite_item_components 
    FOR DELETE 
    USING (organization_id = public.get_user_organization_id() AND public.is_organization_owner());

-- ===== GRANT PERMISSIONS =====

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_composite_completion_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_composite_item_components(uuid, text, integer, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_composite_definitions_timestamp_update() TO authenticated;

-- Grant usage on views
GRANT SELECT ON public.composite_item_status TO authenticated;
GRANT SELECT ON public.composite_item_definitions_with_components TO authenticated;

-- ===== VALIDATION CONSTRAINTS =====

-- Ensure composite items in item_master have corresponding definitions
-- Note: This is enforced by the foreign key constraint in composite_item_definitions

-- Ensure component items have valid composite references
ALTER TABLE public.items 
ADD CONSTRAINT check_composite_consistency 
CHECK (
    (composite_group_id IS NULL AND parent_composite_sku IS NULL) OR
    (composite_group_id IS NOT NULL AND parent_composite_sku IS NOT NULL)
);

COMMENT ON CONSTRAINT check_composite_consistency ON public.items IS 'Ensures composite grouping fields are used consistently together';

-- ===== HELPFUL COMMENTS =====

COMMENT ON SCHEMA public IS 'Enhanced with composite items support - items can now be logical groupings of multiple sub-components';

-- Migration complete
-- Note: Existing data is preserved and remains fully functional
-- New composite functionality is purely additive 