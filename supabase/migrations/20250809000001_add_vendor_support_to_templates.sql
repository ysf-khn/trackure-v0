-- Migration: Add Vendor Support to Workflow Templates
-- This migration adds vendor pricing support to workflow templates

-- Step 1: Create workflow template vendor pricing table
CREATE TABLE IF NOT EXISTS workflow_template_vendor_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    template_stage_id UUID NOT NULL REFERENCES workflow_template_stages(id) ON DELETE CASCADE,
    original_vendor_pricing_id UUID, -- Reference to original pricing record if it still exists
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL, -- Snapshot of vendor name at template creation
    vendor_firm_name TEXT, -- Snapshot of vendor firm name
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    currency TEXT DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP')),
    price_unit TEXT DEFAULT 'per_piece' CHECK (price_unit IN ('per_piece', 'per_kg', 'per_dozen', 'per_hundred')),
    minimum_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure uniqueness per template stage
    CONSTRAINT unique_template_stage_vendor UNIQUE(template_stage_id, vendor_id)
);

-- Create indexes
CREATE INDEX idx_workflow_template_vendor_pricing_template ON workflow_template_vendor_pricing(template_id);
CREATE INDEX idx_workflow_template_vendor_pricing_stage ON workflow_template_vendor_pricing(template_stage_id);
CREATE INDEX idx_workflow_template_vendor_pricing_vendor ON workflow_template_vendor_pricing(vendor_id);

-- Step 2: Drop and recreate create_workflow_template_from_current function to include vendor pricing
DROP FUNCTION IF EXISTS create_workflow_template_from_current(TEXT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_workflow_template_from_current(
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

-- Step 3: Drop and recreate create_workflow_template_from_completed function to include vendor pricing
DROP FUNCTION IF EXISTS create_workflow_template_from_completed(TEXT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_workflow_template_from_completed(
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
    -- Insert all stages into template and copy vendor pricing
    SELECT st.* FROM stage_tree st ORDER BY st.depth_level, st.sequence_order
    INTO v_stage;
    
    -- Process each stage from the completed workflow
    FOR v_stage IN
        WITH RECURSIVE stage_tree AS (
            SELECT DISTINCT ON (ws.id)
                ws.*
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
            
            SELECT 
                ws.*
            FROM workflow_stages ws
            INNER JOIN stage_tree st ON ws.parent_stage_id = st.id
        )
        SELECT * FROM stage_tree ORDER BY depth_level, sequence_order
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

-- Step 4: Drop and recreate apply_workflow_template function to restore vendor assignments
DROP FUNCTION IF EXISTS apply_workflow_template(UUID, TEXT);
CREATE OR REPLACE FUNCTION apply_workflow_template(
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
                    is_active,
                    created_by
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
                    true,
                    auth.uid()
                )
                ON CONFLICT (vendor_id, stage_id, sku) 
                DO UPDATE SET
                    price = EXCLUDED.price,
                    currency = EXCLUDED.currency,
                    price_unit = EXCLUDED.price_unit,
                    minimum_quantity = EXCLUDED.minimum_quantity,
                    lead_time_days = EXCLUDED.lead_time_days,
                    notes = EXCLUDED.notes,
                    is_active = EXCLUDED.is_active,
                    updated_at = NOW();
            END IF;
        END LOOP;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Add RLS policies for new table
ALTER TABLE workflow_template_vendor_pricing ENABLE ROW LEVEL SECURITY;

-- RLS for workflow_template_vendor_pricing
CREATE POLICY "Users can view template vendor pricing in their organization"
    ON workflow_template_vendor_pricing FOR SELECT
    USING (
        template_id IN (
            SELECT id FROM workflow_templates
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Owners can manage template vendor pricing"
    ON workflow_template_vendor_pricing FOR ALL
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
COMMENT ON TABLE workflow_template_vendor_pricing IS 'Stores vendor pricing information for workflow template stages';
COMMENT ON FUNCTION create_workflow_template_from_current IS 'Creates a workflow template from current workflow configuration, optionally including vendor pricing';
COMMENT ON FUNCTION create_workflow_template_from_completed IS 'Creates a workflow template from successfully completed items, optionally including vendor pricing';
COMMENT ON FUNCTION apply_workflow_template IS 'Applies a workflow template to create SKU-specific workflow stages, optionally restoring vendor pricing';