-- Migration: Enhanced Sample Management with Vendor Integration and Change History
-- This migration updates the sample system with vendor integration, structured locations, and comprehensive change tracking

-- Step 1: Drop existing sample tables to rebuild with new schema
DROP VIEW IF EXISTS sample_search_view CASCADE;
DROP TABLE IF EXISTS sample_movement_history CASCADE;
DROP TABLE IF EXISTS sample_images CASCADE;
DROP TABLE IF EXISTS sample_attributes CASCADE;
DROP TABLE IF EXISTS samples CASCADE;

-- Step 2: Create enhanced samples table
CREATE TABLE samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    
    -- Structured location fields
    location_type TEXT NOT NULL CHECK (location_type IN ('organization', 'vendor', 'customer', 'other')),
    location_details JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- Standard attributes as columns for easier querying
    size TEXT NOT NULL,
    finish TEXT,
    finish_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    engraving TEXT,
    engraving_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    
    -- Auto-generated sample code
    sample_code TEXT GENERATED ALWAYS AS (
        sku || '-' || size || '-' || COALESCE(finish, 'NONE') || '-' || 
        LPAD(id::TEXT, 3, '0')
    ) STORED,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure SKU exists in organization
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id) ON DELETE RESTRICT,
    
    -- Ensure unique combination within organization
    CONSTRAINT unique_sample_attributes UNIQUE(organization_id, sku, size, finish, engraving)
);

-- Create indexes
CREATE INDEX idx_samples_organization ON samples(organization_id);
CREATE INDEX idx_samples_sku ON samples(sku);
CREATE INDEX idx_samples_location_type ON samples(location_type);
CREATE INDEX idx_samples_finish_vendor ON samples(finish_vendor_id) WHERE finish_vendor_id IS NOT NULL;
CREATE INDEX idx_samples_engraving_vendor ON samples(engraving_vendor_id) WHERE engraving_vendor_id IS NOT NULL;
CREATE INDEX idx_samples_sample_code ON samples(sample_code);

-- Step 3: Create custom sample attributes table (for additional user-defined fields)
CREATE TABLE sample_custom_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    attribute_unit TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_sample_custom_attribute UNIQUE(sample_id, attribute_name)
);

CREATE INDEX idx_sample_custom_attributes_sample ON sample_custom_attributes(sample_id);
CREATE INDEX idx_sample_custom_attributes_name ON sample_custom_attributes(attribute_name);

-- Step 4: Create comprehensive change history table
CREATE TABLE sample_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'location_changed', 'quantity_changed', 'attribute_changed', 'deleted')),
    field_name TEXT,
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES auth.users(id),
    
    -- Store complete snapshot for major changes
    snapshot JSONB
);

CREATE INDEX idx_sample_change_history_sample ON sample_change_history(sample_id);
CREATE INDEX idx_sample_change_history_type ON sample_change_history(change_type);
CREATE INDEX idx_sample_change_history_date ON sample_change_history(changed_at);
CREATE INDEX idx_sample_change_history_user ON sample_change_history(changed_by);

-- Step 5: Create sample images table (unchanged structure)
CREATE TABLE sample_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type TEXT DEFAULT 'general' CHECK (image_type IN ('general', 'front', 'back', 'side', 'top', 'bottom', 'detail', 'packaging')),
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_sample_images_sample ON sample_images(sample_id);
CREATE INDEX idx_sample_images_type ON sample_images(image_type);

-- Step 6: Create function to track sample changes
CREATE OR REPLACE FUNCTION track_sample_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_field_name TEXT;
    v_old_value JSONB;
    v_new_value JSONB;
    v_change_type TEXT;
BEGIN
    -- Determine change type
    IF TG_OP = 'INSERT' THEN
        v_change_type := 'created';
        v_new_data := to_jsonb(NEW);
        
        -- Log creation
        INSERT INTO sample_change_history (
            sample_id, change_type, new_value, snapshot, changed_by
        ) VALUES (
            NEW.id, v_change_type, v_new_data, v_new_data, NEW.created_by
        );
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Check specific change types
        IF OLD.location_type != NEW.location_type OR OLD.location_details::TEXT != NEW.location_details::TEXT THEN
            v_change_type := 'location_changed';
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name,
                old_value, new_value, changed_by
            ) VALUES (
                NEW.id, v_change_type, 'location',
                jsonb_build_object('type', OLD.location_type, 'details', OLD.location_details),
                jsonb_build_object('type', NEW.location_type, 'details', NEW.location_details),
                auth.uid()
            );
        END IF;
        
        IF OLD.quantity != NEW.quantity THEN
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name,
                old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'quantity_changed', 'quantity',
                to_jsonb(OLD.quantity), to_jsonb(NEW.quantity),
                auth.uid()
            );
        END IF;
        
        -- Check other field changes
        IF OLD.size != NEW.size OR 
           OLD.finish IS DISTINCT FROM NEW.finish OR 
           OLD.engraving IS DISTINCT FROM NEW.engraving OR
           OLD.finish_vendor_id IS DISTINCT FROM NEW.finish_vendor_id OR
           OLD.engraving_vendor_id IS DISTINCT FROM NEW.engraving_vendor_id THEN
            
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name,
                old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'attribute_changed', 'attributes',
                jsonb_build_object(
                    'size', OLD.size,
                    'finish', OLD.finish,
                    'engraving', OLD.engraving,
                    'finish_vendor_id', OLD.finish_vendor_id,
                    'engraving_vendor_id', OLD.engraving_vendor_id
                ),
                jsonb_build_object(
                    'size', NEW.size,
                    'finish', NEW.finish,
                    'engraving', NEW.engraving,
                    'finish_vendor_id', NEW.finish_vendor_id,
                    'engraving_vendor_id', NEW.engraving_vendor_id
                ),
                auth.uid()
            );
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Log deletion
        INSERT INTO sample_change_history (
            sample_id, change_type, old_value, changed_by
        ) VALUES (
            OLD.id, 'deleted', to_jsonb(OLD), auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for change tracking
CREATE TRIGGER track_samples_changes
    AFTER INSERT OR UPDATE OR DELETE ON samples
    FOR EACH ROW
    EXECUTE FUNCTION track_sample_changes();

-- Step 7: Create function to track custom attribute changes
CREATE OR REPLACE FUNCTION track_sample_custom_attribute_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO sample_change_history (
            sample_id, change_type, field_name, new_value, changed_by
        ) VALUES (
            NEW.sample_id, 'attribute_changed', 
            'custom_attribute.' || NEW.attribute_name,
            jsonb_build_object('value', NEW.attribute_value, 'unit', NEW.attribute_unit),
            auth.uid()
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO sample_change_history (
            sample_id, change_type, field_name, old_value, new_value, changed_by
        ) VALUES (
            NEW.sample_id, 'attribute_changed',
            'custom_attribute.' || NEW.attribute_name,
            jsonb_build_object('value', OLD.attribute_value, 'unit', OLD.attribute_unit),
            jsonb_build_object('value', NEW.attribute_value, 'unit', NEW.attribute_unit),
            auth.uid()
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO sample_change_history (
            sample_id, change_type, field_name, old_value, changed_by
        ) VALUES (
            OLD.sample_id, 'attribute_changed',
            'custom_attribute.' || OLD.attribute_name,
            jsonb_build_object('value', OLD.attribute_value, 'unit', OLD.attribute_unit),
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER track_custom_attributes_changes
    AFTER INSERT OR UPDATE OR DELETE ON sample_custom_attributes
    FOR EACH ROW
    EXECUTE FUNCTION track_sample_custom_attribute_changes();

-- Step 8: Create enhanced search view
CREATE OR REPLACE VIEW sample_search_view AS
SELECT 
    s.id,
    s.organization_id,
    s.sample_code,
    s.sku,
    im.master_details->>'name' as sku_name,
    s.quantity,
    s.location_type,
    s.location_details,
    -- Extract vendor names for display
    CASE 
        WHEN s.location_type = 'vendor' THEN v_loc.name
        ELSE NULL
    END as location_vendor_name,
    s.size,
    s.finish,
    s.finish_vendor_id,
    v_finish.name as finish_vendor_name,
    s.engraving,
    s.engraving_vendor_id,
    v_engraving.name as engraving_vendor_name,
    -- Aggregate custom attributes
    COALESCE(
        jsonb_agg(
            DISTINCT jsonb_build_object(
                'name', sca.attribute_name,
                'value', sca.attribute_value,
                'unit', sca.attribute_unit
            )
        ) FILTER (WHERE sca.id IS NOT NULL),
        '[]'::jsonb
    ) as custom_attributes,
    -- Count images
    COUNT(DISTINCT si.id) as image_count,
    s.created_at,
    s.updated_at,
    s.created_by
FROM samples s
LEFT JOIN item_master im ON im.sku = s.sku AND im.organization_id = s.organization_id
LEFT JOIN vendors v_loc ON v_loc.id = (s.location_details->>'vendor_id')::UUID
LEFT JOIN vendors v_finish ON v_finish.id = s.finish_vendor_id
LEFT JOIN vendors v_engraving ON v_engraving.id = s.engraving_vendor_id
LEFT JOIN sample_custom_attributes sca ON sca.sample_id = s.id
LEFT JOIN sample_images si ON si.sample_id = s.id
GROUP BY 
    s.id, s.organization_id, s.sample_code, s.sku, im.master_details,
    s.quantity, s.location_type, s.location_details, v_loc.name,
    s.size, s.finish, s.finish_vendor_id, v_finish.name,
    s.engraving, s.engraving_vendor_id, v_engraving.name,
    s.created_at, s.updated_at, s.created_by;

-- Step 9: Create function to get sample with full details
CREATE OR REPLACE FUNCTION get_sample_details(p_sample_id UUID)
RETURNS TABLE (
    sample JSONB,
    history JSONB,
    images JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Sample details
        (SELECT to_jsonb(s.*) || jsonb_build_object(
            'sku_name', im.master_details->>'name',
            'finish_vendor', to_jsonb(v_finish.*),
            'engraving_vendor', to_jsonb(v_engraving.*),
            'location_vendor', to_jsonb(v_loc.*),
            'custom_attributes', COALESCE(
                jsonb_agg(to_jsonb(sca.*)) FILTER (WHERE sca.id IS NOT NULL),
                '[]'::jsonb
            )
        )
        FROM samples s
        LEFT JOIN item_master im ON im.sku = s.sku AND im.organization_id = s.organization_id
        LEFT JOIN vendors v_finish ON v_finish.id = s.finish_vendor_id
        LEFT JOIN vendors v_engraving ON v_engraving.id = s.engraving_vendor_id
        LEFT JOIN vendors v_loc ON v_loc.id = (s.location_details->>'vendor_id')::UUID
        LEFT JOIN sample_custom_attributes sca ON sca.sample_id = s.id
        WHERE s.id = p_sample_id
        GROUP BY s.id, im.master_details, v_finish.id, v_engraving.id, v_loc.id
        ),
        -- Change history
        (SELECT COALESCE(jsonb_agg(
            to_jsonb(h.*) || jsonb_build_object(
                'changed_by_user', p.full_name
            ) ORDER BY h.changed_at DESC
        ), '[]'::jsonb)
        FROM sample_change_history h
        LEFT JOIN profiles p ON p.id = h.changed_by
        WHERE h.sample_id = p_sample_id
        ),
        -- Images
        (SELECT COALESCE(jsonb_agg(
            to_jsonb(si.*) ORDER BY si.display_order, si.uploaded_at
        ), '[]'::jsonb)
        FROM sample_images si
        WHERE si.sample_id = p_sample_id
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Enable RLS
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_custom_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_change_history ENABLE ROW LEVEL SECURITY;

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

-- RLS policies for custom attributes
CREATE POLICY "Users can view sample custom attributes"
    ON sample_custom_attributes FOR SELECT
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage sample custom attributes"
    ON sample_custom_attributes FOR ALL
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

-- RLS policies for images
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

-- RLS policies for change history (read-only)
CREATE POLICY "Users can view sample change history"
    ON sample_change_history FOR SELECT
    USING (
        sample_id IN (
            SELECT id FROM samples
            WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Grant permissions
GRANT SELECT ON sample_search_view TO authenticated;

-- Update triggers
CREATE TRIGGER update_samples_updated_at
    BEFORE UPDATE ON samples
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sample_custom_attributes_updated_at
    BEFORE UPDATE ON sample_custom_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE samples IS 'Enhanced sample tracking with vendor integration and structured locations';
COMMENT ON TABLE sample_custom_attributes IS 'User-defined custom attributes for samples';
COMMENT ON TABLE sample_change_history IS 'Comprehensive change tracking for all sample modifications';
COMMENT ON COLUMN samples.location_type IS 'Type of location: organization, vendor, customer, or other';
COMMENT ON COLUMN samples.location_details IS 'JSON details specific to location type';
COMMENT ON FUNCTION get_sample_details IS 'Get complete sample details including history and images';