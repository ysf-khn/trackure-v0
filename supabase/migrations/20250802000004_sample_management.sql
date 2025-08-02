-- Migration: Sample Management System
-- This migration adds comprehensive sample tracking with flexible attributes

-- Step 1: Create samples table
CREATE TABLE IF NOT EXISTS samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT,
    sample_code TEXT NOT NULL, -- Unique identifier within organization
    name TEXT NOT NULL,
    description TEXT,
    location TEXT, -- Where the sample is physically stored
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'with_customer', 'in_production', 'damaged', 'lost')),
    received_date DATE,
    received_from TEXT, -- Customer/vendor who provided the sample
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id) ON DELETE SET NULL,
    CONSTRAINT unique_sample_code_per_org UNIQUE(organization_id, sample_code)
);

-- Create indexes
CREATE INDEX idx_samples_organization ON samples(organization_id);
CREATE INDEX idx_samples_sku ON samples(sku);
CREATE INDEX idx_samples_status ON samples(status);
CREATE INDEX idx_samples_code ON samples(sample_code);

-- Step 2: Create flexible sample attributes table
CREATE TABLE IF NOT EXISTS sample_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    attribute_category TEXT NOT NULL CHECK (attribute_category IN (
        'physical', 'visual', 'material', 'finishing', 'packaging', 'custom'
    )),
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    attribute_unit TEXT, -- e.g., 'mm', 'grams', etc.
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_sample_attribute UNIQUE(sample_id, attribute_category, attribute_name)
);

-- Create indexes
CREATE INDEX idx_sample_attributes_sample ON sample_attributes(sample_id);
CREATE INDEX idx_sample_attributes_category ON sample_attributes(attribute_category);
CREATE INDEX idx_sample_attributes_name ON sample_attributes(attribute_name);

-- Step 3: Create sample images table
CREATE TABLE IF NOT EXISTS sample_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type TEXT DEFAULT 'general' CHECK (image_type IN (
        'general', 'front', 'back', 'side', 'top', 'bottom', 'detail', 'packaging'
    )),
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_sample_images_sample ON sample_images(sample_id);
CREATE INDEX idx_sample_images_type ON sample_images(image_type);

-- Step 4: Create sample movement history
CREATE TABLE IF NOT EXISTS sample_movement_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    from_location TEXT,
    to_location TEXT,
    given_to TEXT, -- Person/customer who received the sample
    expected_return_date DATE,
    actual_return_date DATE,
    notes TEXT,
    moved_at TIMESTAMPTZ DEFAULT NOW(),
    moved_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_sample_movement_history_sample ON sample_movement_history(sample_id);
CREATE INDEX idx_sample_movement_history_date ON sample_movement_history(moved_at);

-- Step 5: Create predefined attribute templates for common attributes
CREATE TABLE IF NOT EXISTS sample_attribute_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    attribute_category TEXT NOT NULL,
    attribute_name TEXT NOT NULL,
    default_unit TEXT,
    input_type TEXT DEFAULT 'text' CHECK (input_type IN ('text', 'number', 'select', 'multiselect', 'boolean', 'date')),
    possible_values TEXT[], -- For select/multiselect types
    is_required BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_attribute_template UNIQUE(organization_id, attribute_category, attribute_name)
);

-- Insert default attribute templates
INSERT INTO sample_attribute_templates (organization_id, attribute_category, attribute_name, default_unit, input_type, display_order)
SELECT DISTINCT 
    o.id,
    category.val,
    attribute.val,
    unit.val,
    input.val,
    ord.val
FROM organizations o
CROSS JOIN (VALUES 
    ('physical', 'length', 'mm', 'number', 1),
    ('physical', 'width', 'mm', 'number', 2),
    ('physical', 'height', 'mm', 'number', 3),
    ('physical', 'diameter', 'mm', 'number', 4),
    ('physical', 'weight', 'grams', 'number', 5),
    ('visual', 'color', NULL, 'text', 1),
    ('visual', 'finish', NULL, 'select', 2),
    ('visual', 'pattern', NULL, 'text', 3),
    ('material', 'base_material', NULL, 'text', 1),
    ('material', 'plating', NULL, 'select', 2),
    ('material', 'coating', NULL, 'text', 3),
    ('finishing', 'engraving', NULL, 'text', 1),
    ('finishing', 'polishing', NULL, 'select', 2),
    ('finishing', 'texture', NULL, 'text', 3)
) AS data(category, attribute, unit, input, ord)
CROSS JOIN LATERAL (VALUES (data.category)) AS category(val)
CROSS JOIN LATERAL (VALUES (data.attribute)) AS attribute(val)
CROSS JOIN LATERAL (VALUES (data.unit)) AS unit(val)
CROSS JOIN LATERAL (VALUES (data.input)) AS input(val)
CROSS JOIN LATERAL (VALUES (data.ord)) AS ord(val)
ON CONFLICT DO NOTHING;

-- Step 6: Function to create sample with attributes
CREATE OR REPLACE FUNCTION create_sample_with_attributes(
    p_organization_id UUID,
    p_sample_data JSONB,
    p_attributes JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_sample_id UUID;
    v_attribute JSONB;
BEGIN
    -- Insert sample
    INSERT INTO samples (
        organization_id,
        sku,
        sample_code,
        name,
        description,
        location,
        status,
        received_date,
        received_from,
        created_by
    )
    VALUES (
        p_organization_id,
        p_sample_data->>'sku',
        p_sample_data->>'sample_code',
        p_sample_data->>'name',
        p_sample_data->>'description',
        p_sample_data->>'location',
        COALESCE(p_sample_data->>'status', 'available'),
        (p_sample_data->>'received_date')::DATE,
        p_sample_data->>'received_from',
        auth.uid()
    )
    RETURNING id INTO v_sample_id;
    
    -- Insert attributes
    FOR v_attribute IN SELECT * FROM jsonb_array_elements(p_attributes)
    LOOP
        INSERT INTO sample_attributes (
            sample_id,
            attribute_category,
            attribute_name,
            attribute_value,
            attribute_unit,
            display_order
        )
        VALUES (
            v_sample_id,
            v_attribute->>'category',
            v_attribute->>'name',
            v_attribute->>'value',
            v_attribute->>'unit',
            COALESCE((v_attribute->>'display_order')::INTEGER, 0)
        );
    END LOOP;
    
    -- Log initial creation in movement history
    INSERT INTO sample_movement_history (
        sample_id,
        to_status,
        to_location,
        notes,
        moved_by
    )
    VALUES (
        v_sample_id,
        COALESCE(p_sample_data->>'status', 'available'),
        p_sample_data->>'location',
        'Sample created',
        auth.uid()
    );
    
    RETURN v_sample_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Function to track sample movement
CREATE OR REPLACE FUNCTION move_sample(
    p_sample_id UUID,
    p_new_status TEXT,
    p_new_location TEXT DEFAULT NULL,
    p_given_to TEXT DEFAULT NULL,
    p_expected_return_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status TEXT;
    v_current_location TEXT;
BEGIN
    -- Get current sample details
    SELECT status, location 
    INTO v_current_status, v_current_location
    FROM samples
    WHERE id = p_sample_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;
    
    -- Update sample
    UPDATE samples
    SET 
        status = p_new_status,
        location = COALESCE(p_new_location, location),
        updated_at = NOW()
    WHERE id = p_sample_id;
    
    -- Log movement
    INSERT INTO sample_movement_history (
        sample_id,
        from_status,
        to_status,
        from_location,
        to_location,
        given_to,
        expected_return_date,
        notes,
        moved_by
    )
    VALUES (
        p_sample_id,
        v_current_status,
        p_new_status,
        v_current_location,
        p_new_location,
        p_given_to,
        p_expected_return_date,
        p_notes,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create sample search view
CREATE OR REPLACE VIEW sample_search_view AS
SELECT 
    s.id,
    s.organization_id,
    s.sample_code,
    s.name,
    s.description,
    s.sku,
    COALESCE(im.sku, s.sku) as sku_name, -- Use SKU as name if item_master doesn't have name column
    s.status,
    s.location,
    s.received_from,
    s.received_date,
    -- Aggregate attributes as JSONB
    COALESCE(
        jsonb_agg(
            DISTINCT jsonb_build_object(
                'category', sa.attribute_category,
                'name', sa.attribute_name,
                'value', sa.attribute_value,
                'unit', sa.attribute_unit
            )
        ) FILTER (WHERE sa.id IS NOT NULL),
        '[]'::jsonb
    ) as attributes,
    -- Count images
    COUNT(DISTINCT si.id) as image_count,
    s.created_at,
    s.updated_at
FROM samples s
LEFT JOIN item_master im ON im.sku = s.sku AND im.organization_id = s.organization_id
LEFT JOIN sample_attributes sa ON sa.sample_id = s.id
LEFT JOIN sample_images si ON si.sample_id = s.id
GROUP BY s.id, s.organization_id, s.sample_code, s.name, s.description, 
         s.sku, im.sku, s.status, s.location, s.received_from, 
         s.received_date, s.created_at, s.updated_at;

-- Grant access to the view
GRANT SELECT ON sample_search_view TO authenticated;

-- Step 9: Enable RLS on sample tables
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_movement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_attribute_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for samples
CREATE POLICY "Users can view samples in their organization"
    ON samples FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage samples based on permissions"
    ON samples FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            ) OR 
            worker_has_permission('samples.manage')
        )
    );

-- RLS policies for sample_attributes
CREATE POLICY "Users can view sample attributes"
    ON sample_attributes FOR SELECT
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage sample attributes"
    ON sample_attributes FOR ALL
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid() AND (
                    role = 'Owner' OR
                    worker_has_permission('samples.manage')
                )
            )
        )
    );

-- Similar RLS policies for other sample tables
CREATE POLICY "Users can view sample images"
    ON sample_images FOR SELECT
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage sample images"
    ON sample_images FOR ALL
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid() AND (
                    role = 'Owner' OR
                    worker_has_permission('samples.manage')
                )
            )
        )
    );

-- RLS for movement history (read-only for workers)
CREATE POLICY "Users can view sample movement history"
    ON sample_movement_history FOR SELECT
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Authorized users can create movement history"
    ON sample_movement_history FOR INSERT
    WITH CHECK (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid() AND (
                    role = 'Owner' OR
                    worker_has_permission('samples.manage')
                )
            )
        )
    );

-- RLS for attribute templates
CREATE POLICY "Users can view attribute templates"
    ON sample_attribute_templates FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage attribute templates"
    ON sample_attribute_templates FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role = 'Owner'
        )
    );

-- Add sample permissions to worker_permissions
INSERT INTO worker_permissions (organization_id, permission_key, enabled)
SELECT DISTINCT
    o.id,
    perm.permission_key,
    false -- Default to disabled, admins can enable per organization
FROM organizations o
CROSS JOIN (VALUES 
    ('samples.view'),
    ('samples.manage')
) AS perm(permission_key)
WHERE NOT EXISTS (
    SELECT 1 FROM worker_permissions wp 
    WHERE wp.organization_id = o.id 
    AND wp.permission_key = perm.permission_key
)
ON CONFLICT (organization_id, permission_key) DO NOTHING;

-- Add triggers for updated_at
CREATE TRIGGER update_samples_updated_at
    BEFORE UPDATE ON samples
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sample_attributes_updated_at
    BEFORE UPDATE ON sample_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE samples IS 'Stores physical sample information with flexible tracking';
COMMENT ON TABLE sample_attributes IS 'Flexible key-value attributes for samples (shape, color, engraving, etc.)';
COMMENT ON TABLE sample_images IS 'Images associated with samples';
COMMENT ON TABLE sample_movement_history IS 'Tracks sample location and status changes';
COMMENT ON TABLE sample_attribute_templates IS 'Predefined attribute templates for consistent data entry';
COMMENT ON FUNCTION create_sample_with_attributes IS 'Creates a sample with its attributes in a single transaction';
COMMENT ON FUNCTION move_sample IS 'Updates sample status/location and logs the movement';