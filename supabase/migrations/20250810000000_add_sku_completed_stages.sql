-- Migration: Add SKU-Specific Completed Stages
-- Purpose: Ensure each SKU workflow has its own "Completed" stage
-- This allows proper workflow isolation per SKU

-- Function to create a "Completed" stage for a specific SKU workflow
CREATE OR REPLACE FUNCTION public.create_completed_stage_for_sku(
    p_organization_id uuid,
    p_sku text
)
RETURNS uuid AS $$
DECLARE
    v_completed_stage_id uuid;
BEGIN
    -- Check if a "Completed" stage already exists for this SKU
    SELECT id INTO v_completed_stage_id
    FROM public.workflow_stages
    WHERE organization_id = p_organization_id 
    AND sku = p_sku
    AND name = 'Completed';

    IF v_completed_stage_id IS NOT NULL THEN
        -- Stage already exists, return its ID
        RETURN v_completed_stage_id;
    END IF;

    -- Create the "Completed" stage with a very high sequence order (100000)
    -- This ensures it will always be the last stage regardless of how many stages are added
    INSERT INTO public.workflow_stages (
        id,
        name,
        sequence_order,
        organization_id,
        sku,
        is_default,
        parent_stage_id,
        depth_level,
        full_path,
        is_leaf_stage,
        created_at
    ) VALUES (
        gen_random_uuid(),
        'Completed',
        100000,
        p_organization_id,
        p_sku,
        false,
        NULL,
        0,
        '100000',
        true,
        now()
    ) RETURNING id INTO v_completed_stage_id;

    RETURN v_completed_stage_id;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure all existing SKU workflows have a completed stage
CREATE OR REPLACE FUNCTION public.ensure_completed_stages_for_all_sku_workflows()
RETURNS void AS $$
DECLARE
    sku_workflow RECORD;
BEGIN
    -- Find all distinct SKU workflows
    FOR sku_workflow IN 
        SELECT DISTINCT organization_id, sku 
        FROM public.workflow_stages 
        WHERE sku IS NOT NULL
    LOOP
        -- Create completed stage for each SKU workflow
        PERFORM public.create_completed_stage_for_sku(
            sku_workflow.organization_id, 
            sku_workflow.sku
        );
    END LOOP;
    
    RAISE NOTICE 'Ensured "Completed" stages exist for all SKU workflows';
END;
$$ LANGUAGE plpgsql;

-- Update the apply_workflow_template function to automatically add completed stage
CREATE OR REPLACE FUNCTION public.apply_workflow_template(
    p_template_id UUID,
    p_sku TEXT,
    p_restore_vendor_pricing BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
DECLARE
    v_organization_id UUID;
    v_stage_mapping JSONB := '{}'::JSONB;
    v_stage RECORD;
    v_new_stage_id UUID;
    v_template_vendor_pricing RECORD;
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
    
    -- Restore vendor pricing if requested
    IF p_restore_vendor_pricing THEN
        FOR v_template_vendor_pricing IN
            SELECT 
                wtvp.*,
                wts.id as template_stage_id
            FROM workflow_template_vendor_pricing wtvp
            JOIN workflow_template_stages wts ON wts.id = wtvp.template_stage_id
            WHERE wtvp.template_id = p_template_id
        LOOP
            -- Get the new stage ID from our mapping
            v_new_stage_id := (v_stage_mapping->>(v_template_vendor_pricing.template_stage_id::TEXT))::UUID;
            
            -- Only create vendor pricing if the vendor still exists and is active
            IF EXISTS (
                SELECT 1 FROM vendors 
                WHERE id = v_template_vendor_pricing.vendor_id 
                AND is_active = true
                AND organization_id = v_organization_id
            ) THEN
                -- Insert or update vendor pricing (handle conflicts)
                INSERT INTO vendor_stage_pricing (
                    vendor_id,
                    stage_id,
                    sku,
                    organization_id,
                    price,
                    currency,
                    price_unit,
                    minimum_quantity,
                    lead_time_days,
                    notes,
                    is_active
                )
                VALUES (
                    v_template_vendor_pricing.vendor_id,
                    v_new_stage_id,
                    p_sku,
                    v_organization_id,
                    v_template_vendor_pricing.price,
                    v_template_vendor_pricing.currency,
                    v_template_vendor_pricing.price_unit,
                    v_template_vendor_pricing.minimum_quantity,
                    v_template_vendor_pricing.lead_time_days,
                    v_template_vendor_pricing.notes,
                    true
                )
                ON CONFLICT (vendor_id, stage_id, sku, organization_id) 
                DO UPDATE SET
                    price = EXCLUDED.price,
                    currency = EXCLUDED.currency,
                    price_unit = EXCLUDED.price_unit,
                    minimum_quantity = EXCLUDED.minimum_quantity,
                    lead_time_days = EXCLUDED.lead_time_days,
                    notes = EXCLUDED.notes,
                    is_active = true,
                    updated_at = now();
            END IF;
        END LOOP;
    END IF;
    
    -- IMPORTANT: Create completed stage for this SKU workflow
    PERFORM public.create_completed_stage_for_sku(v_organization_id, p_sku);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the create_workflow_template_from_current function to ensure completed stage is included
CREATE OR REPLACE FUNCTION public.create_workflow_template_from_current(
    p_sku TEXT,
    p_organization_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_include_vendor_pricing BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    v_template_id UUID;
    v_stage_mapping JSONB := '{}'::JSONB;
    v_stage RECORD;
    v_new_template_stage_id UUID;
    v_vendor_pricing RECORD;
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
    
    -- Ensure the SKU workflow has a completed stage before creating template
    PERFORM public.create_completed_stage_for_sku(p_organization_id, p_sku);
    
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
    
    -- Copy current workflow stages to template stages (including the completed stage)
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
        
        -- Copy vendor pricing for this stage if requested
        IF p_include_vendor_pricing THEN
            FOR v_vendor_pricing IN
                SELECT vsp.*, v.name as vendor_name, v.firm_name as vendor_firm_name
                FROM vendor_stage_pricing vsp
                JOIN vendors v ON v.id = vsp.vendor_id
                WHERE vsp.stage_id = v_stage.id
                AND vsp.sku = p_sku
                AND vsp.organization_id = p_organization_id
                AND vsp.is_active = true
            LOOP
                INSERT INTO workflow_template_vendor_pricing (
                    template_id,
                    template_stage_id,
                    original_vendor_pricing_id,
                    vendor_id,
                    vendor_name,
                    vendor_firm_name,
                    price,
                    currency,
                    price_unit,
                    minimum_quantity,
                    lead_time_days,
                    notes
                )
                VALUES (
                    v_template_id,
                    v_new_template_stage_id,
                    v_vendor_pricing.id,
                    v_vendor_pricing.vendor_id,
                    v_vendor_pricing.vendor_name,
                    v_vendor_pricing.vendor_firm_name,
                    v_vendor_pricing.price,
                    v_vendor_pricing.currency,
                    v_vendor_pricing.price_unit,
                    v_vendor_pricing.minimum_quantity,
                    v_vendor_pricing.lead_time_days,
                    v_vendor_pricing.notes
                );
            END LOOP;
        END IF;
    END LOOP;
    
    -- Update template statistics
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
                    AND sku = p_sku
                    AND name = 'Completed'
                )
                GROUP BY i.id, i.created_at
            ) completion_times
        )
    WHERE id = v_template_id;
    
    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to ensure all existing SKU workflows have completed stages
SELECT public.ensure_completed_stages_for_all_sku_workflows();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_completed_stage_for_sku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_completed_stages_for_all_sku_workflows() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.create_completed_stage_for_sku IS 'Creates a "Completed" stage for a specific SKU workflow if it does not exist';
COMMENT ON FUNCTION public.ensure_completed_stages_for_all_sku_workflows IS 'Ensures all existing SKU workflows have a completed stage';