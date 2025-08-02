-- Migration: Vendor Management System
-- This migration adds vendor management with stage-specific pricing per SKU

-- Step 1: Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    firm_name TEXT,
    gst TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    contact_person TEXT,
    remarks TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_vendor_name_per_org UNIQUE(organization_id, name),
    CONSTRAINT unique_vendor_gst_per_org UNIQUE(organization_id, gst)
);

-- Create indexes
CREATE INDEX idx_vendors_organization ON vendors(organization_id);
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_vendors_name ON vendors(name);

-- Step 2: Create vendor stage pricing table
CREATE TABLE IF NOT EXISTS vendor_stage_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    currency TEXT DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP')),
    price_unit TEXT DEFAULT 'per_piece' CHECK (price_unit IN ('per_piece', 'per_kg', 'per_dozen', 'per_hundred')),
    minimum_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id) ON DELETE CASCADE,
    
    -- Ensure uniqueness per vendor-stage-sku combination
    CONSTRAINT unique_vendor_stage_sku_price UNIQUE(vendor_id, stage_id, sku)
    
    -- Note: Leaf stage validation will be handled via trigger instead of CHECK constraint
);

-- Create indexes
CREATE INDEX idx_vendor_stage_pricing_vendor ON vendor_stage_pricing(vendor_id);
CREATE INDEX idx_vendor_stage_pricing_stage ON vendor_stage_pricing(stage_id);
CREATE INDEX idx_vendor_stage_pricing_sku ON vendor_stage_pricing(sku, organization_id);
CREATE INDEX idx_vendor_stage_pricing_active ON vendor_stage_pricing(is_active);

-- Step 2.1: Create trigger function to validate leaf stages
CREATE OR REPLACE FUNCTION validate_vendor_pricing_leaf_stage()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the stage is a leaf stage
    IF NOT EXISTS (
        SELECT 1 FROM workflow_stages 
        WHERE id = NEW.stage_id AND is_leaf_stage = true
    ) THEN
        RAISE EXCEPTION 'Vendor pricing can only be set for leaf stages (stages without children)';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate leaf stages on INSERT and UPDATE
CREATE TRIGGER validate_vendor_pricing_leaf_stage_trigger
    BEFORE INSERT OR UPDATE ON vendor_stage_pricing
    FOR EACH ROW
    EXECUTE FUNCTION validate_vendor_pricing_leaf_stage();

-- Step 3: Create vendor assignments for tracking which vendor is processing items
CREATE TABLE IF NOT EXISTS item_vendor_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    allocation_id UUID NOT NULL REFERENCES item_stage_allocations(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(12, 2),
    total_price DECIMAL(12, 2),
    currency TEXT DEFAULT 'INR',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expected_completion TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES auth.users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    CONSTRAINT unique_item_allocation_vendor UNIQUE(allocation_id, vendor_id)
);

-- Create indexes
CREATE INDEX idx_item_vendor_assignments_item ON item_vendor_assignments(item_id);
CREATE INDEX idx_item_vendor_assignments_vendor ON item_vendor_assignments(vendor_id);
CREATE INDEX idx_item_vendor_assignments_allocation ON item_vendor_assignments(allocation_id);
CREATE INDEX idx_item_vendor_assignments_completed ON item_vendor_assignments(completed_at);

-- Step 4: Function to calculate total cost for an item through a workflow
CREATE OR REPLACE FUNCTION calculate_workflow_cost(
    p_sku TEXT,
    p_organization_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_workflow_path UUID[] DEFAULT NULL -- Optional specific path through workflow
)
RETURNS TABLE (
    total_cost DECIMAL(12, 2),
    currency TEXT,
    cost_breakdown JSONB
) AS $$
DECLARE
    v_total_cost DECIMAL(12, 2) := 0;
    v_currency TEXT := 'INR';
    v_breakdown JSONB := '[]'::JSONB;
    v_stage RECORD;
BEGIN
    -- If no specific path provided, calculate for all leaf stages
    IF p_workflow_path IS NULL THEN
        -- Get all leaf stages for the SKU workflow
        FOR v_stage IN
            SELECT 
                ws.id,
                ws.name,
                ws.full_path,
                MIN(vsp.price) as min_price,
                STRING_AGG(DISTINCT v.name, ', ') as vendors
            FROM workflow_stages ws
            LEFT JOIN vendor_stage_pricing vsp ON vsp.stage_id = ws.id 
                AND vsp.sku = p_sku 
                AND vsp.is_active = true
            LEFT JOIN vendors v ON v.id = vsp.vendor_id AND v.is_active = true
            WHERE ws.organization_id = p_organization_id
            AND ws.is_leaf_stage = true
            AND (ws.sku = p_sku OR (ws.sku IS NULL AND NOT EXISTS (
                SELECT 1 FROM workflow_stages ws2 
                WHERE ws2.organization_id = p_organization_id 
                AND ws2.sku = p_sku
            )))
            GROUP BY ws.id, ws.name, ws.full_path
            ORDER BY ws.sequence_order
        LOOP
            v_total_cost := v_total_cost + COALESCE(v_stage.min_price * p_quantity, 0);
            v_breakdown := v_breakdown || jsonb_build_object(
                'stage_id', v_stage.id,
                'stage_name', v_stage.name,
                'stage_path', v_stage.full_path,
                'min_price', v_stage.min_price,
                'vendors', v_stage.vendors,
                'subtotal', COALESCE(v_stage.min_price * p_quantity, 0)
            );
        END LOOP;
    ELSE
        -- Calculate cost for specific path
        FOR v_stage IN
            SELECT 
                ws.id,
                ws.name,
                ws.full_path,
                MIN(vsp.price) as min_price,
                STRING_AGG(DISTINCT v.name, ', ') as vendors
            FROM UNNEST(p_workflow_path) WITH ORDINALITY AS path(stage_id, ord)
            JOIN workflow_stages ws ON ws.id = path.stage_id
            LEFT JOIN vendor_stage_pricing vsp ON vsp.stage_id = ws.id 
                AND vsp.sku = p_sku 
                AND vsp.is_active = true
            LEFT JOIN vendors v ON v.id = vsp.vendor_id AND v.is_active = true
            GROUP BY ws.id, ws.name, ws.full_path, path.ord
            ORDER BY path.ord
        LOOP
            v_total_cost := v_total_cost + COALESCE(v_stage.min_price * p_quantity, 0);
            v_breakdown := v_breakdown || jsonb_build_object(
                'stage_id', v_stage.id,
                'stage_name', v_stage.name,
                'stage_path', v_stage.full_path,
                'min_price', v_stage.min_price,
                'vendors', v_stage.vendors,
                'subtotal', COALESCE(v_stage.min_price * p_quantity, 0)
            );
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT v_total_cost, v_currency, v_breakdown;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Function to get best vendor for a stage
CREATE OR REPLACE FUNCTION get_best_vendor_for_stage(
    p_stage_id UUID,
    p_sku TEXT,
    p_quantity INTEGER DEFAULT 1
)
RETURNS TABLE (
    vendor_id UUID,
    vendor_name TEXT,
    price DECIMAL(12, 2),
    total_cost DECIMAL(12, 2),
    lead_time_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id as vendor_id,
        v.name as vendor_name,
        vsp.price,
        vsp.price * p_quantity as total_cost,
        vsp.lead_time_days
    FROM vendor_stage_pricing vsp
    JOIN vendors v ON v.id = vsp.vendor_id
    WHERE vsp.stage_id = p_stage_id
    AND vsp.sku = p_sku
    AND vsp.is_active = true
    AND v.is_active = true
    AND p_quantity >= vsp.minimum_quantity
    ORDER BY vsp.price ASC, vsp.lead_time_days ASC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Step 6: View for vendor performance metrics
CREATE OR REPLACE VIEW vendor_performance_summary AS
SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    v.organization_id,
    COUNT(DISTINCT iva.item_id) as total_items_processed,
    COUNT(DISTINCT iva.id) as total_assignments,
    SUM(iva.quantity) as total_quantity_processed,
    SUM(iva.total_price) as total_revenue,
    AVG(EXTRACT(EPOCH FROM (iva.completed_at - iva.assigned_at)) / 86400)::NUMERIC(10,2) as avg_completion_days,
    COUNT(DISTINCT vsp.sku) as total_skus_supported,
    COUNT(DISTINCT vsp.stage_id) as total_stages_supported
FROM vendors v
LEFT JOIN item_vendor_assignments iva ON iva.vendor_id = v.id
LEFT JOIN vendor_stage_pricing vsp ON vsp.vendor_id = v.id AND vsp.is_active = true
GROUP BY v.id, v.name, v.organization_id;

-- Grant access to the view
GRANT SELECT ON vendor_performance_summary TO authenticated;

-- Step 7: Enable RLS on vendor tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_stage_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_vendor_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendors
CREATE POLICY "Users can view vendors in their organization"
    ON vendors FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage vendors"
    ON vendors FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role = 'Owner'
        )
    );

-- RLS policies for vendor_stage_pricing
CREATE POLICY "Users can view vendor pricing in their organization"
    ON vendor_stage_pricing FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage vendor pricing"
    ON vendor_stage_pricing FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role = 'Owner'
        )
    );

-- RLS policies for item_vendor_assignments
CREATE POLICY "Users can view vendor assignments in their organization"
    ON item_vendor_assignments FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create vendor assignments based on permissions"
    ON item_vendor_assignments FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            ) OR 
            worker_has_permission('vendors.assign')
        )
    );

CREATE POLICY "Users can update vendor assignments based on permissions"
    ON item_vendor_assignments FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            ) OR 
            worker_has_permission('vendors.assign')
        )
    );

-- Step 8: Add vendor permissions to worker_permissions (if table exists)
DO $$
BEGIN
    -- Check if worker_permissions table exists with the expected structure
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'worker_permissions'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_permissions' AND column_name = 'user_id'
    ) THEN
        INSERT INTO worker_permissions (user_id, permission_key, is_granted, organization_id)
        SELECT 
            p.id,
            'vendors.view',
            true,
            p.organization_id
        FROM profiles p
        WHERE p.role = 'Worker'
        AND NOT EXISTS (
            SELECT 1 FROM worker_permissions wp 
            WHERE wp.user_id = p.id 
            AND wp.permission_key = 'vendors.view'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Added vendor permissions to existing worker_permissions table';
    ELSE
        RAISE NOTICE 'worker_permissions table does not exist or has different structure, skipping permission setup';
    END IF;
END $$;

-- Add trigger to update timestamps
CREATE TRIGGER update_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_stage_pricing_updated_at
    BEFORE UPDATE ON vendor_stage_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE vendors IS 'Stores vendor/supplier information for each organization';
COMMENT ON TABLE vendor_stage_pricing IS 'Stores pricing information for each vendor-stage-SKU combination';
COMMENT ON TABLE item_vendor_assignments IS 'Tracks which vendor is processing specific items at each stage';
COMMENT ON FUNCTION calculate_workflow_cost IS 'Calculates the total cost for processing an item through its workflow';
COMMENT ON FUNCTION get_best_vendor_for_stage IS 'Returns the most cost-effective vendors for a specific stage and SKU';