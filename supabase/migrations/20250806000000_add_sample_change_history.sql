-- Migration: Add Sample Change History Tracking
-- This migration creates a table and triggers to track all changes made to samples

-- Step 1: Create sample_change_history table
CREATE TABLE IF NOT EXISTS sample_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES auth.users(id),
    
    -- Index for performance
    CONSTRAINT sample_change_history_sample_fk FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sample_change_history_sample_id ON sample_change_history(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_change_history_changed_at ON sample_change_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sample_change_history_changed_by ON sample_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_sample_change_history_change_type ON sample_change_history(change_type);

-- Step 2: Create function to track sample changes
CREATE OR REPLACE FUNCTION track_sample_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        -- Log sample creation
        INSERT INTO sample_change_history (
            sample_id, change_type, changed_by, new_value
        ) VALUES (
            NEW.id, 'created', v_user_id, 
            jsonb_build_object(
                'sku', NEW.sku,
                'name', NEW.name,
                'location', NEW.location,
                'quantity', NEW.quantity,
                'size', NEW.size
            )::TEXT
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Track location changes
        IF OLD.location IS DISTINCT FROM NEW.location THEN
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name, old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'updated', 'location', OLD.location, NEW.location, v_user_id
            );
        END IF;
        
        -- Track quantity changes
        IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name, old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'updated', 'quantity', OLD.quantity::TEXT, NEW.quantity::TEXT, v_user_id
            );
        END IF;
        
        -- Track name changes
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name, old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'updated', 'name', OLD.name, NEW.name, v_user_id
            );
        END IF;
        
        -- Track size changes
        IF OLD.size IS DISTINCT FROM NEW.size THEN
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name, old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'updated', 'size', OLD.size, NEW.size, v_user_id
            );
        END IF;
        
        -- Track SKU changes (rare but possible)
        IF OLD.sku IS DISTINCT FROM NEW.sku THEN
            INSERT INTO sample_change_history (
                sample_id, change_type, field_name, old_value, new_value, changed_by
            ) VALUES (
                NEW.id, 'updated', 'sku', OLD.sku, NEW.sku, v_user_id
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Log sample deletion
        INSERT INTO sample_change_history (
            sample_id, change_type, changed_by, old_value
        ) VALUES (
            OLD.id, 'deleted', v_user_id,
            jsonb_build_object(
                'sku', OLD.sku,
                'name', OLD.name,
                'location', OLD.location,
                'quantity', OLD.quantity,
                'size', OLD.size
            )::TEXT
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger on samples table
DROP TRIGGER IF EXISTS track_samples_changes ON samples;
CREATE TRIGGER track_samples_changes
    AFTER INSERT OR UPDATE OR DELETE ON samples
    FOR EACH ROW
    EXECUTE FUNCTION track_sample_changes();

-- Step 4: Enable RLS on sample_change_history
ALTER TABLE sample_change_history ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
-- Users can view change history for samples in their organization
CREATE POLICY "Users can view sample change history in their organization"
    ON sample_change_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM samples s
            WHERE s.id = sample_change_history.sample_id
            AND s.organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- History is read-only, no insert/update/delete policies needed for users
-- The trigger function uses SECURITY DEFINER to bypass RLS when inserting

-- Step 6: Grant permissions
GRANT SELECT ON sample_change_history TO authenticated;

-- Step 7: Add comments for documentation
COMMENT ON TABLE sample_change_history IS 'Tracks all changes made to samples including creation, updates, and deletion';
COMMENT ON COLUMN sample_change_history.change_type IS 'Type of change: created, updated, or deleted';
COMMENT ON COLUMN sample_change_history.field_name IS 'Name of the field that was changed (NULL for created/deleted)';
COMMENT ON COLUMN sample_change_history.old_value IS 'Previous value of the field';
COMMENT ON COLUMN sample_change_history.new_value IS 'New value of the field';
COMMENT ON COLUMN sample_change_history.changed_by IS 'User ID who made the change';

-- Step 8: Create a helper function to get formatted history
CREATE OR REPLACE FUNCTION get_sample_history(p_sample_id UUID)
RETURNS TABLE (
    id UUID,
    change_type TEXT,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ,
    changed_by UUID,
    changed_by_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sch.id,
        sch.change_type,
        sch.field_name,
        sch.old_value,
        sch.new_value,
        sch.changed_at,
        sch.changed_by,
        p.full_name as changed_by_name
    FROM sample_change_history sch
    LEFT JOIN profiles p ON p.id = sch.changed_by
    WHERE sch.sample_id = p_sample_id
    ORDER BY sch.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_sample_history TO authenticated;