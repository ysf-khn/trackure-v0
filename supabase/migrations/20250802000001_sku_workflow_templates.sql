-- Migration: SKU-specific Workflows and Templates
-- This migration adds support for SKU-specific workflows and workflow templates

-- Step 1: Add workflow_type to items table to track which workflow system an item uses
ALTER TABLE items
ADD COLUMN IF NOT EXISTS workflow_type TEXT DEFAULT 'organization' CHECK (workflow_type IN ('organization', 'sku'));

-- Step 2: Create workflow templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    completed_count INTEGER DEFAULT 0, -- Track how many times this template has been used successfully
    avg_completion_days NUMERIC(10,2), -- Average days to complete items using this workflow
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT fk_template_sku 
    FOREIGN KEY (sku, organization_id) 
    REFERENCES item_master(sku, organization_id) 
    ON DELETE CASCADE,
    
    CONSTRAINT unique_active_template_per_sku 
    UNIQUE (organization_id, sku, is_active)
);

-- Create index for faster lookups
CREATE INDEX idx_workflow_templates_org_sku ON workflow_templates(organization_id, sku);
CREATE INDEX idx_workflow_templates_active ON workflow_templates(is_active);

-- Step 3: Create workflow template stages (snapshot of successful workflow configurations)
CREATE TABLE IF NOT EXISTS workflow_template_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    original_stage_id UUID, -- Reference to the original stage if it still exists
    parent_stage_id UUID, -- Self-referencing for tree structure within template
    name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    depth_level INTEGER NOT NULL DEFAULT 0,
    full_path TEXT NOT NULL,
    is_leaf_stage BOOLEAN DEFAULT true,
    location TEXT,
    avg_time_hours NUMERIC(10,2), -- Average time spent in this stage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (parent_stage_id) REFERENCES workflow_template_stages(id) ON DELETE CASCADE,
    CONSTRAINT unique_template_stage_sequence UNIQUE(parent_stage_id, template_id, sequence_order)
);

-- Create indexes
CREATE INDEX idx_workflow_template_stages_template ON workflow_template_stages(template_id);
CREATE INDEX idx_workflow_template_stages_parent ON workflow_template_stages(parent_stage_id);

-- Step 4: Function to create a workflow template from completed items
CREATE OR REPLACE FUNCTION create_workflow_template_from_completed(
    p_sku TEXT,
    p_organization_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_template_id UUID;
    v_stage_mapping JSONB := '{}'::JSONB;
    v_stage RECORD;
BEGIN
    -- Deactivate any existing active template for this SKU
    UPDATE workflow_templates 
    SET is_active = false 
    WHERE organization_id = p_organization_id 
    AND sku = p_sku 
    AND is_active = true;
    
    -- Create new template
    INSERT INTO workflow_templates (
        organization_id, 
        sku, 
        name, 
        description, 
        created_by
    )
    VALUES (
        p_organization_id, 
        p_sku, 
        p_name, 
        p_description, 
        auth.uid()
    )
    RETURNING id INTO v_template_id;
    
    -- Copy workflow stages used by completed items of this SKU
    -- This uses a CTE to build the tree structure
    WITH RECURSIVE stage_tree AS (
        -- Get all stages used by completed items of this SKU (root stages)
        SELECT DISTINCT ON (ws.id)
            ws.*,
            NULL::UUID as template_parent_id
        FROM workflow_stages ws
        JOIN item_stage_allocations isa ON isa.stage_id = ws.id
        JOIN items i ON i.id = isa.item_id
        WHERE i.sku = p_sku
        AND i.organization_id = p_organization_id
        AND ws.parent_stage_id IS NULL
        AND EXISTS (
            SELECT 1 FROM item_movement_history imh
            WHERE imh.item_id = i.id
            AND imh.to_stage_id IN (
                SELECT id FROM workflow_stages 
                WHERE organization_id = p_organization_id 
                AND name = 'Completed'
            )
        )
        
        UNION ALL
        
        -- Get all child stages recursively
        SELECT 
            ws.*,
            (v_stage_mapping->>(st.id::TEXT))::UUID as template_parent_id
        FROM workflow_stages ws
        INNER JOIN stage_tree st ON ws.parent_stage_id = st.id
    )
    -- Insert all stages into template
    INSERT INTO workflow_template_stages (
        template_id,
        original_stage_id,
        parent_stage_id,
        name,
        sequence_order,
        depth_level,
        full_path,
        is_leaf_stage,
        location
    )
    SELECT 
        v_template_id,
        st.id,
        st.template_parent_id,
        st.name,
        st.sequence_order,
        st.depth_level,
        st.full_path,
        st.is_leaf_stage,
        st.location
    FROM stage_tree st
    ORDER BY st.depth_level, st.sequence_order;
    
    -- Update template statistics
    UPDATE workflow_templates
    SET 
        completed_count = (
            SELECT COUNT(DISTINCT i.id)
            FROM items i
            WHERE i.sku = p_sku
            AND i.organization_id = p_organization_id
            AND EXISTS (
                SELECT 1 FROM item_movement_history imh
                WHERE imh.item_id = i.id
                AND imh.to_stage_id IN (
                    SELECT id FROM workflow_stages 
                    WHERE organization_id = p_organization_id 
                    AND name = 'Completed'
                )
            )
        ),
        avg_completion_days = (
            SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400)
            FROM (
                SELECT 
                    i.created_at,
                    MAX(imh.moved_at) as completed_at
                FROM items i
                JOIN item_movement_history imh ON imh.item_id = i.id
                WHERE i.sku = p_sku
                AND i.organization_id = p_organization_id
                AND imh.to_stage_id IN (
                    SELECT id FROM workflow_stages 
                    WHERE organization_id = p_organization_id 
                    AND name = 'Completed'
                )
                GROUP BY i.id, i.created_at
            ) completion_times
        )
    WHERE id = v_template_id;
    
    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Function to apply a workflow template to create SKU-specific workflow
CREATE OR REPLACE FUNCTION apply_workflow_template(
    p_template_id UUID,
    p_sku TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_organization_id UUID;
    v_stage_mapping JSONB := '{}'::JSONB;
    v_stage RECORD;
    v_new_stage_id UUID;
BEGIN
    -- Get organization_id from template
    SELECT organization_id INTO v_organization_id
    FROM workflow_templates
    WHERE id = p_template_id;
    
    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Template not found';
    END IF;
    
    -- Delete existing SKU-specific workflow stages
    DELETE FROM workflow_stages
    WHERE organization_id = v_organization_id
    AND sku = p_sku;
    
    -- Copy template stages to actual workflow stages
    FOR v_stage IN 
        SELECT * FROM workflow_template_stages
        WHERE template_id = p_template_id
        ORDER BY depth_level, sequence_order
    LOOP
        INSERT INTO workflow_stages (
            organization_id,
            sku,
            parent_stage_id,
            name,
            sequence_order,
            depth_level,
            full_path,
            is_leaf_stage,
            location
        )
        VALUES (
            v_organization_id,
            p_sku,
            CASE 
                WHEN v_stage.parent_stage_id IS NULL THEN NULL
                ELSE (v_stage_mapping->>(v_stage.parent_stage_id::TEXT))::UUID
            END,
            v_stage.name,
            v_stage.sequence_order,
            v_stage.depth_level,
            v_stage.full_path,
            v_stage.is_leaf_stage,
            v_stage.location
        )
        RETURNING id INTO v_new_stage_id;
        
        -- Store mapping for child stages
        v_stage_mapping := v_stage_mapping || jsonb_build_object(v_stage.id::TEXT, v_new_stage_id::TEXT);
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Function to determine which workflow to use for an item
CREATE OR REPLACE FUNCTION get_item_workflow_stages(
    p_item_id UUID
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    parent_stage_id UUID,
    depth_level INTEGER,
    full_path TEXT,
    sequence_order INTEGER,
    is_leaf_stage BOOLEAN,
    location TEXT
) AS $$
DECLARE
    v_sku TEXT;
    v_organization_id UUID;
    v_workflow_type TEXT;
BEGIN
    -- Get item details
    SELECT i.sku, i.organization_id, i.workflow_type
    INTO v_sku, v_organization_id, v_workflow_type
    FROM items i
    WHERE i.id = p_item_id;
    
    -- Return appropriate workflow stages
    RETURN QUERY
    SELECT 
        ws.id,
        ws.name,
        ws.parent_stage_id,
        ws.depth_level,
        ws.full_path,
        ws.sequence_order,
        ws.is_leaf_stage,
        ws.location
    FROM workflow_stages ws
    WHERE ws.organization_id = v_organization_id
    AND (
        (v_workflow_type = 'sku' AND ws.sku = v_sku) OR
        (v_workflow_type = 'organization' AND ws.sku IS NULL) OR
        (v_workflow_type IS NULL AND ws.sku IS NULL) -- Fallback for legacy items
    )
    ORDER BY ws.sequence_order, ws.depth_level;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Trigger to set workflow_type when creating new items
CREATE OR REPLACE FUNCTION set_item_workflow_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if SKU-specific workflow exists
    IF EXISTS (
        SELECT 1 FROM workflow_stages
        WHERE organization_id = NEW.organization_id
        AND sku = NEW.sku
        AND parent_stage_id IS NULL -- At least one root stage
    ) THEN
        NEW.workflow_type := 'sku';
    ELSE
        NEW.workflow_type := 'organization';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_item_workflow_type_trigger
BEFORE INSERT ON items
FOR EACH ROW
EXECUTE FUNCTION set_item_workflow_type();

-- Step 8: Update RLS policies for new tables
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_template_stages ENABLE ROW LEVEL SECURITY;

-- RLS for workflow_templates
CREATE POLICY "Users can view workflow templates in their organization"
    ON workflow_templates FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage workflow templates"
    ON workflow_templates FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role = 'Owner'
        )
    );

-- RLS for workflow_template_stages
CREATE POLICY "Users can view workflow template stages"
    ON workflow_template_stages FOR SELECT
    USING (
        template_id IN (
            SELECT id FROM workflow_templates
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Owners can manage workflow template stages"
    ON workflow_template_stages FOR ALL
    USING (
        template_id IN (
            SELECT id FROM workflow_templates
            WHERE organization_id IN (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            )
        )
    );

-- Add comments for documentation
COMMENT ON TABLE workflow_templates IS 'Stores successful workflow configurations as templates for reuse';
COMMENT ON TABLE workflow_template_stages IS 'Stores the stage hierarchy for workflow templates';
COMMENT ON COLUMN items.workflow_type IS 'Determines whether item uses organization-wide or SKU-specific workflow';
COMMENT ON FUNCTION create_workflow_template_from_completed IS 'Creates a workflow template from successfully completed items of a specific SKU';
COMMENT ON FUNCTION apply_workflow_template IS 'Applies a workflow template to create SKU-specific workflow stages';