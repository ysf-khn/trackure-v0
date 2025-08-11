-- Migration: Add create_workflow_template_from_current function
-- This adds the missing function that creates workflow templates from current workflow configuration

CREATE OR REPLACE FUNCTION create_workflow_template_from_current(
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
    v_new_template_stage_id UUID;
BEGIN
    -- Check if current workflow exists for this SKU
    IF NOT EXISTS (
        SELECT 1 FROM workflow_stages
        WHERE organization_id = p_organization_id
        AND sku = p_sku
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'No workflow found for SKU % in organization %', p_sku, p_organization_id;
    END IF;
    
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
        created_by,
        is_active
    )
    VALUES (
        p_organization_id, 
        p_sku, 
        p_name, 
        p_description, 
        auth.uid(),
        true
    )
    RETURNING id INTO v_template_id;
    
    -- Copy current workflow stages to template stages
    -- Process stages in the correct order (parents before children)
    
    -- Insert stages one by one to handle parent-child relationships properly
    FOR v_stage IN 
        SELECT ws.* FROM workflow_stages ws
        WHERE ws.organization_id = p_organization_id
        AND ws.sku = p_sku
        ORDER BY ws.depth_level, ws.sequence_order
    LOOP
        -- Insert template stage
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
        VALUES (
            v_template_id,
            v_stage.id,
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
        RETURNING id INTO v_new_template_stage_id;
        
        -- Store mapping for child stages
        v_stage_mapping := v_stage_mapping || jsonb_build_object(v_stage.id::TEXT, v_new_template_stage_id::TEXT);
    END LOOP;
    
    -- Update template statistics based on existing completed items (if any)
    UPDATE workflow_templates
    SET 
        completed_count = (
            SELECT COUNT(DISTINCT i.id)
            FROM items i
            WHERE i.sku = p_sku
            AND i.organization_id = p_organization_id
            AND i.status = 'Completed'
        ),
        avg_completion_days = (
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
            FROM items i
            WHERE i.sku = p_sku
            AND i.organization_id = p_organization_id
            AND i.status = 'Completed'
        )
    WHERE id = v_template_id;
    
    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION create_workflow_template_from_current IS 'Creates a workflow template from the current workflow configuration for a specific SKU';