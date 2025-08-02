-- Migration: Weight/Size Standardization and SKU Cost Calculations
-- This migration standardizes weight/size units and adds SKU cost calculation features

-- Step 1: Add unit preferences to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'pounds', 'grams', 'ounces')),
ADD COLUMN IF NOT EXISTS size_unit TEXT DEFAULT 'inches' CHECK (size_unit IN ('inches', 'cm', 'mm', 'feet'));

-- Step 2: Add standardized weight and size columns to items table
-- Note: instance_details is a JSONB column in items table, not a separate table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS net_weight_kg DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS gross_weight_kg DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS size_inches DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS size_unit TEXT DEFAULT 'inches';

-- Add constraints for valid units
ALTER TABLE items
ADD CONSTRAINT check_weight_unit CHECK (weight_unit IN ('kg', 'pounds', 'grams', 'ounces')),
ADD CONSTRAINT check_size_unit CHECK (size_unit IN ('inches', 'cm', 'mm', 'feet'));

-- Step 3: Create SKU cost calculations table
CREATE TABLE IF NOT EXISTS sku_cost_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    workflow_type TEXT DEFAULT 'sku' CHECK (workflow_type IN ('organization', 'sku')),
    base_material_cost DECIMAL(12, 2) DEFAULT 0,
    total_workflow_cost DECIMAL(12, 2) DEFAULT 0,
    markup_percentage DECIMAL(5, 2) DEFAULT 0,
    final_calculated_cost DECIMAL(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    cost_per_unit TEXT DEFAULT 'per_piece' CHECK (cost_per_unit IN ('per_piece', 'per_kg', 'per_dozen')),
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    calculation_details JSONB, -- Store detailed breakdown
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id) ON DELETE CASCADE,
    CONSTRAINT unique_active_sku_cost_calc UNIQUE(organization_id, sku, is_active)
);

-- Create indexes
CREATE INDEX idx_sku_cost_calculations_org_sku ON sku_cost_calculations(organization_id, sku);
CREATE INDEX idx_sku_cost_calculations_active ON sku_cost_calculations(is_active);
CREATE INDEX idx_sku_cost_calculations_last_calc ON sku_cost_calculations(last_calculated_at);

-- Step 4: Create unit conversion functions
CREATE OR REPLACE FUNCTION convert_weight_to_kg(
    p_weight DECIMAL(10, 4),
    p_from_unit TEXT
)
RETURNS DECIMAL(10, 4) AS $$
BEGIN
    CASE p_from_unit
        WHEN 'kg' THEN RETURN p_weight;
        WHEN 'pounds' THEN RETURN p_weight * 0.453592;
        WHEN 'grams' THEN RETURN p_weight / 1000;
        WHEN 'ounces' THEN RETURN p_weight * 0.0283495;
        ELSE RETURN p_weight; -- Default to kg
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION convert_size_to_inches(
    p_size DECIMAL(10, 4),
    p_from_unit TEXT
)
RETURNS DECIMAL(10, 4) AS $$
BEGIN
    CASE p_from_unit
        WHEN 'inches' THEN RETURN p_size;
        WHEN 'cm' THEN RETURN p_size / 2.54;
        WHEN 'mm' THEN RETURN p_size / 25.4;
        WHEN 'feet' THEN RETURN p_size * 12;
        ELSE RETURN p_size; -- Default to inches
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION convert_weight_from_kg(
    p_weight_kg DECIMAL(10, 4),
    p_to_unit TEXT
)
RETURNS DECIMAL(10, 4) AS $$
BEGIN
    CASE p_to_unit
        WHEN 'kg' THEN RETURN p_weight_kg;
        WHEN 'pounds' THEN RETURN p_weight_kg / 0.453592;
        WHEN 'grams' THEN RETURN p_weight_kg * 1000;
        WHEN 'ounces' THEN RETURN p_weight_kg / 0.0283495;
        ELSE RETURN p_weight_kg; -- Default to kg
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION convert_size_from_inches(
    p_size_inches DECIMAL(10, 4),
    p_to_unit TEXT
)
RETURNS DECIMAL(10, 4) AS $$
BEGIN
    CASE p_to_unit
        WHEN 'inches' THEN RETURN p_size_inches;
        WHEN 'cm' THEN RETURN p_size_inches * 2.54;
        WHEN 'mm' THEN RETURN p_size_inches * 25.4;
        WHEN 'feet' THEN RETURN p_size_inches / 12;
        ELSE RETURN p_size_inches; -- Default to inches
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 5: Function to calculate SKU cost with detailed breakdown
CREATE OR REPLACE FUNCTION calculate_sku_cost(
    p_sku TEXT,
    p_organization_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_base_material_cost DECIMAL(12, 2) DEFAULT 0,
    p_markup_percentage DECIMAL(5, 2) DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_workflow_cost_result RECORD;
    v_total_workflow_cost DECIMAL(12, 2) := 0;
    v_final_cost DECIMAL(12, 2);
    v_currency TEXT := 'INR';
    v_calculation_details JSONB;
BEGIN
    -- Get workflow cost breakdown
    SELECT * INTO v_workflow_cost_result
    FROM calculate_workflow_cost(p_sku, p_organization_id, p_quantity);
    
    v_total_workflow_cost := COALESCE(v_workflow_cost_result.total_cost, 0);
    v_currency := COALESCE(v_workflow_cost_result.currency, 'INR');
    
    -- Calculate final cost with markup
    v_final_cost := (p_base_material_cost + v_total_workflow_cost) * (1 + p_markup_percentage / 100);
    
    -- Build detailed calculation
    v_calculation_details := jsonb_build_object(
        'sku', p_sku,
        'quantity', p_quantity,
        'base_material_cost', p_base_material_cost,
        'workflow_cost', v_total_workflow_cost,
        'subtotal', p_base_material_cost + v_total_workflow_cost,
        'markup_percentage', p_markup_percentage,
        'markup_amount', (p_base_material_cost + v_total_workflow_cost) * (p_markup_percentage / 100),
        'final_cost', v_final_cost,
        'cost_per_piece', CASE WHEN p_quantity > 0 THEN v_final_cost / p_quantity ELSE 0 END,
        'currency', v_currency,
        'workflow_breakdown', v_workflow_cost_result.cost_breakdown,
        'calculated_at', NOW()
    );
    
    RETURN v_calculation_details;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Function to update or create SKU cost calculation
CREATE OR REPLACE FUNCTION update_sku_cost_calculation(
    p_sku TEXT,
    p_organization_id UUID,
    p_base_material_cost DECIMAL(12, 2) DEFAULT 0,
    p_markup_percentage DECIMAL(5, 2) DEFAULT 0,
    p_workflow_type TEXT DEFAULT 'sku'
)
RETURNS UUID AS $$
DECLARE
    v_calculation_result JSONB;
    v_cost_calc_id UUID;
BEGIN
    -- Calculate the cost
    v_calculation_result := calculate_sku_cost(
        p_sku, 
        p_organization_id, 
        1, 
        p_base_material_cost, 
        p_markup_percentage
    );
    
    -- Deactivate any existing active calculation
    UPDATE sku_cost_calculations
    SET is_active = false
    WHERE organization_id = p_organization_id
    AND sku = p_sku
    AND is_active = true;
    
    -- Insert new calculation
    INSERT INTO sku_cost_calculations (
        organization_id,
        sku,
        workflow_type,
        base_material_cost,
        total_workflow_cost,
        markup_percentage,
        final_calculated_cost,
        currency,
        calculation_details,
        created_by
    )
    VALUES (
        p_organization_id,
        p_sku,
        p_workflow_type,
        p_base_material_cost,
        (v_calculation_result->>'workflow_cost')::DECIMAL(12, 2),
        p_markup_percentage,
        (v_calculation_result->>'final_cost')::DECIMAL(12, 2),
        v_calculation_result->>'currency',
        v_calculation_result,
        auth.uid()
    )
    RETURNING id INTO v_cost_calc_id;
    
    RETURN v_cost_calc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create comprehensive SKU management view
CREATE OR REPLACE VIEW sku_management_view AS
SELECT 
    im.sku,
    im.organization_id,
    im.sku as sku_name,
    im.master_details as sku_description,
    im.master_details as specifications,
    
    -- Cost information
    scc.final_calculated_cost,
    scc.base_material_cost,
    scc.total_workflow_cost,
    scc.markup_percentage,
    scc.currency,
    scc.cost_per_unit,
    scc.last_calculated_at,
    
    -- Active items summary
    COUNT(DISTINCT i.id) FILTER (WHERE NOT i.is_scrapped) as active_items_count,
    SUM(i.total_quantity) FILTER (WHERE NOT i.is_scrapped) as total_active_quantity,
    
    -- Completed items summary
    COUNT(DISTINCT ci.item_id) as completed_items_count,
    SUM(ci.quantity) as total_completed_quantity,
    
    -- Workflow stages count
    COUNT(DISTINCT ws.id) as workflow_stages_count,
    COUNT(DISTINCT ws.id) FILTER (WHERE ws.is_leaf_stage) as leaf_stages_count,
    
    -- Vendor information
    COUNT(DISTINCT vsp.vendor_id) as vendors_count,
    MIN(vsp.price) as min_vendor_price,
    AVG(vsp.price) as avg_vendor_price,
    
    -- Sample information
    COUNT(DISTINCT s.id) as samples_count,
    
    -- Recent activity
    MAX(i.created_at) as last_item_created,
    MAX(imh.moved_at) as last_movement,
    
    im.created_at
    
FROM item_master im
LEFT JOIN sku_cost_calculations scc ON scc.sku = im.sku 
    AND scc.organization_id = im.organization_id 
    AND scc.is_active = true
LEFT JOIN items i ON i.sku = im.sku 
    AND i.organization_id = im.organization_id
LEFT JOIN (
    SELECT DISTINCT isa.item_id, isa.quantity
    FROM item_stage_allocations isa
    JOIN workflow_stages ws ON isa.stage_id = ws.id
    WHERE ws.name = 'Completed'
) ci ON ci.item_id = i.id
LEFT JOIN workflow_stages ws ON ws.sku = im.sku 
    AND ws.organization_id = im.organization_id
LEFT JOIN vendor_stage_pricing vsp ON vsp.sku = im.sku 
    AND vsp.organization_id = im.organization_id 
    AND vsp.is_active = true
LEFT JOIN samples s ON s.sku = im.sku 
    AND s.organization_id = im.organization_id
LEFT JOIN item_movement_history imh ON imh.item_id = i.id
GROUP BY 
    im.sku, im.organization_id, im.master_details,
    scc.final_calculated_cost, scc.base_material_cost, scc.total_workflow_cost,
    scc.markup_percentage, scc.currency, scc.cost_per_unit, scc.last_calculated_at,
    im.created_at;

-- Grant access to the view
GRANT SELECT ON sku_management_view TO authenticated;

-- Step 8: Enable RLS on new tables
ALTER TABLE sku_cost_calculations ENABLE ROW LEVEL SECURITY;

-- RLS policies for sku_cost_calculations
CREATE POLICY "Users can view SKU cost calculations in their organization"
    ON sku_cost_calculations FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage SKU cost calculations"
    ON sku_cost_calculations FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role = 'Owner'
        )
    );

-- Step 9: Trigger to auto-update SKU costs when vendor pricing changes
CREATE OR REPLACE FUNCTION auto_update_sku_costs()
RETURNS TRIGGER AS $$
BEGIN
    -- Update SKU cost calculation when vendor pricing changes
    IF TG_OP = 'UPDATE' AND (OLD.price != NEW.price OR OLD.is_active != NEW.is_active) THEN
        -- Get current cost calculation
        UPDATE sku_cost_calculations
        SET last_calculated_at = NOW(),
            calculation_details = calculate_sku_cost(
                NEW.sku, 
                NEW.organization_id, 
                1, 
                base_material_cost, 
                markup_percentage
            )
        WHERE sku = NEW.sku 
        AND organization_id = NEW.organization_id 
        AND is_active = true;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_sku_costs_trigger
    AFTER UPDATE OR INSERT ON vendor_stage_pricing
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_sku_costs();

-- Step 10: Add trigger for updated_at columns
CREATE TRIGGER update_sku_cost_calculations_updated_at
    BEFORE UPDATE ON sku_cost_calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 11: Create function to migrate existing weight data (if any exists)
CREATE OR REPLACE FUNCTION migrate_existing_weight_data()
RETURNS TEXT AS $$
DECLARE
    migration_count INTEGER := 0;
BEGIN
    -- This function can be called manually to migrate any existing weight data
    -- from JSONB instance_details or other sources if needed
    
    -- Example migration logic (adjust based on actual data structure)
    -- UPDATE items 
    -- SET net_weight_kg = (instance_details->>'weight')::DECIMAL(10,4)
    -- WHERE instance_details->>'weight' IS NOT NULL
    -- AND net_weight_kg IS NULL;
    
    GET DIAGNOSTICS migration_count = ROW_COUNT;
    
    RETURN format('Migrated %s records', migration_count);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN organizations.weight_unit IS 'Default weight unit for the organization (kg, pounds, grams, ounces)';
COMMENT ON COLUMN organizations.size_unit IS 'Default size unit for the organization (inches, cm, mm, feet)';
COMMENT ON TABLE sku_cost_calculations IS 'Stores calculated costs for SKUs including material costs, workflow costs, and markup';
COMMENT ON FUNCTION convert_weight_to_kg IS 'Converts weight from any unit to kilograms';
COMMENT ON FUNCTION convert_size_to_inches IS 'Converts size from any unit to inches';
COMMENT ON FUNCTION calculate_sku_cost IS 'Calculates total cost for a SKU including material, workflow, and markup costs';
COMMENT ON FUNCTION update_sku_cost_calculation IS 'Updates or creates a new cost calculation for a SKU';
COMMENT ON VIEW sku_management_view IS 'Comprehensive view of SKU data including costs, items, workflows, vendors, and samples';