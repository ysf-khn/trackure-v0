-- Migration: Infinite Nesting Workflow Structure
-- This migration converts the existing two-level workflow system (stages and sub-stages)
-- into a self-referencing tree structure that supports unlimited nesting depth

-- Step 1: Add new columns to workflow_stages table for tree structure
ALTER TABLE workflow_stages 
ADD COLUMN IF NOT EXISTS parent_stage_id UUID NULL,
ADD COLUMN IF NOT EXISTS depth_level INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS full_path TEXT,
ADD COLUMN IF NOT EXISTS is_leaf_stage BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sku TEXT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add foreign key for parent_stage_id (self-referencing)
ALTER TABLE workflow_stages 
ADD CONSTRAINT fk_parent_stage 
FOREIGN KEY (parent_stage_id) 
REFERENCES workflow_stages(id) 
ON DELETE CASCADE;

-- Add foreign key for SKU (references item_master)
ALTER TABLE workflow_stages
ADD CONSTRAINT fk_workflow_stage_sku
FOREIGN KEY (sku, organization_id) 
REFERENCES item_master(sku, organization_id)
ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_stages_parent ON workflow_stages(parent_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_path ON workflow_stages USING gin(to_tsvector('english', full_path));
CREATE INDEX IF NOT EXISTS idx_workflow_stages_org_sku ON workflow_stages(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_leaf ON workflow_stages(is_leaf_stage);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_depth ON workflow_stages(depth_level);

-- Add constraint to ensure unique sequence order within same parent
-- First drop any existing constraints that might conflict
DO $$
BEGIN
    -- Try to drop existing sequence constraint if it exists
    BEGIN
        ALTER TABLE workflow_stages DROP CONSTRAINT IF EXISTS unique_workflow_stage_sequence;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore error if constraint doesn't exist
        NULL;
    END;
    
    -- Try to drop any existing tree sequence constraint
    BEGIN
        ALTER TABLE workflow_stages DROP CONSTRAINT IF EXISTS unique_workflow_stage_tree_sequence;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore error if constraint doesn't exist
        NULL;
    END;
END $$;

-- Note: Unique indexes will be created after sequence reorganization to avoid conflicts

-- Step 2: Create a function to update full_path and is_leaf_stage
CREATE OR REPLACE FUNCTION update_workflow_stage_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT;
BEGIN
    -- Get parent's full path if exists
    IF NEW.parent_stage_id IS NOT NULL THEN
        SELECT full_path INTO parent_path 
        FROM workflow_stages 
        WHERE id = NEW.parent_stage_id;
        
        NEW.full_path := parent_path || ' > ' || NEW.name;
        NEW.depth_level := (
            SELECT depth_level + 1 
            FROM workflow_stages 
            WHERE id = NEW.parent_stage_id
        );
    ELSE
        NEW.full_path := NEW.name;
        NEW.depth_level := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for path updates
CREATE TRIGGER update_workflow_stage_path_trigger
BEFORE INSERT OR UPDATE OF name, parent_stage_id ON workflow_stages
FOR EACH ROW
EXECUTE FUNCTION update_workflow_stage_path();

-- Step 3: Create a function to update is_leaf_stage when children are added/removed
CREATE OR REPLACE FUNCTION update_parent_leaf_status()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT or UPDATE with parent_stage_id
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.parent_stage_id IS NOT NULL THEN
        UPDATE workflow_stages 
        SET is_leaf_stage = false 
        WHERE id = NEW.parent_stage_id;
    END IF;
    
    -- On DELETE or UPDATE removing parent_stage_id
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.parent_stage_id IS NOT NULL AND NEW.parent_stage_id IS NULL) THEN
        -- Check if old parent has any other children
        IF NOT EXISTS (
            SELECT 1 FROM workflow_stages 
            WHERE parent_stage_id = COALESCE(OLD.parent_stage_id, NEW.parent_stage_id)
            AND id != COALESCE(OLD.id, NEW.id)
        ) THEN
            UPDATE workflow_stages 
            SET is_leaf_stage = true 
            WHERE id = COALESCE(OLD.parent_stage_id, NEW.parent_stage_id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for leaf status updates
CREATE TRIGGER update_parent_leaf_status_trigger
AFTER INSERT OR UPDATE OR DELETE ON workflow_stages
FOR EACH ROW
EXECUTE FUNCTION update_parent_leaf_status();

-- Step 4: Update item_stage_allocations to support tree structure
ALTER TABLE item_stage_allocations
ADD COLUMN IF NOT EXISTS stage_path TEXT,
ADD COLUMN IF NOT EXISTS is_leaf_allocation BOOLEAN DEFAULT true;

-- Step 5: Migrate existing data
-- First, update all existing workflow_stages (top level, no parent)
UPDATE workflow_stages 
SET 
    parent_stage_id = NULL,
    depth_level = 0,
    full_path = name,
    is_leaf_stage = NOT EXISTS (
        SELECT 1 
        FROM workflow_sub_stages 
        WHERE stage_id = workflow_stages.id
    )
WHERE parent_stage_id IS NULL;

-- First, check if workflow_sub_stages table exists and migrate if it does
DO $$
DECLARE
    max_sequence_order INTEGER;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workflow_sub_stages') THEN
        -- First, temporarily drop the unique constraint that's causing issues
        ALTER TABLE workflow_stages DROP CONSTRAINT IF EXISTS workflow_stages_organization_id_sequence_order_key;
        
        -- Get the maximum sequence_order across all organizations to avoid conflicts
        SELECT COALESCE(MAX(sequence_order), 0) INTO max_sequence_order FROM workflow_stages;
        
        -- Migrate existing workflow_sub_stages as children of their parent stages
        -- Use a different sequence_order strategy to avoid conflicts
        INSERT INTO workflow_stages (
            id,
            parent_stage_id, 
            organization_id, 
            name, 
            sequence_order,
            depth_level, 
            full_path, 
            is_leaf_stage, 
            sku,
            created_at
        )
        SELECT 
            wss.id,
            wss.stage_id as parent_stage_id,
            wss.organization_id,
            wss.name,
            max_sequence_order + ROW_NUMBER() OVER (ORDER BY wss.organization_id, wss.stage_id, wss.sequence_order) as sequence_order,
            1 as depth_level,
            ws.name || ' > ' || wss.name as full_path,
            true as is_leaf_stage,
            NULL as sku,
            COALESCE(wss.created_at, NOW())
        FROM workflow_sub_stages wss
        JOIN workflow_stages ws ON wss.stage_id = ws.id
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated workflow_sub_stages to tree structure';
    ELSE
        RAISE NOTICE 'workflow_sub_stages table does not exist, skipping migration';
    END IF;
END $$;

-- Update parent stages to no longer be leaf stages
UPDATE workflow_stages 
SET is_leaf_stage = false 
WHERE id IN (
    SELECT DISTINCT parent_stage_id 
    FROM workflow_stages 
    WHERE parent_stage_id IS NOT NULL
);

-- Step 5.5: Simple approach - just ensure no duplicate sequence orders exist
-- We'll rely on the unique indexes to catch any real duplicates
DO $$
BEGIN
    -- Just add a large number to all sequence orders to avoid conflicts during migration
    UPDATE workflow_stages 
    SET sequence_order = sequence_order + 10000;
    
    RAISE NOTICE 'Adjusted sequence orders to avoid conflicts';
END $$;

-- Step 5.6: Now create the unique indexes after sequence reorganization
-- This allows each level of the tree to have its own sequence ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_stages_unique_tree_sequence_with_sku 
ON workflow_stages (parent_stage_id, organization_id, sku, sequence_order)
WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_stages_unique_tree_sequence_no_sku 
ON workflow_stages (parent_stage_id, organization_id, sequence_order)
WHERE sku IS NULL;

-- Step 6: Create helper functions for tree traversal

-- Function to get all descendants of a stage
CREATE OR REPLACE FUNCTION get_stage_descendants(stage_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    parent_stage_id UUID,
    depth_level INTEGER,
    full_path TEXT,
    sequence_order INTEGER,
    is_leaf_stage BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE stage_tree AS (
        -- Base case: the stage itself
        SELECT 
            ws.id,
            ws.name,
            ws.parent_stage_id,
            ws.depth_level,
            ws.full_path,
            ws.sequence_order,
            ws.is_leaf_stage
        FROM workflow_stages ws
        WHERE ws.id = stage_id
        
        UNION ALL
        
        -- Recursive case: all children
        SELECT 
            ws.id,
            ws.name,
            ws.parent_stage_id,
            ws.depth_level,
            ws.full_path,
            ws.sequence_order,
            ws.is_leaf_stage
        FROM workflow_stages ws
        INNER JOIN stage_tree st ON ws.parent_stage_id = st.id
    )
    SELECT * FROM stage_tree;
END;
$$ LANGUAGE plpgsql;

-- Function to get all ancestors of a stage
CREATE OR REPLACE FUNCTION get_stage_ancestors(stage_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    parent_stage_id UUID,
    depth_level INTEGER,
    full_path TEXT,
    sequence_order INTEGER,
    is_leaf_stage BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE stage_tree AS (
        -- Base case: the stage itself
        SELECT 
            ws.id,
            ws.name,
            ws.parent_stage_id,
            ws.depth_level,
            ws.full_path,
            ws.sequence_order,
            ws.is_leaf_stage
        FROM workflow_stages ws
        WHERE ws.id = stage_id
        
        UNION ALL
        
        -- Recursive case: all parents
        SELECT 
            ws.id,
            ws.name,
            ws.parent_stage_id,
            ws.depth_level,
            ws.full_path,
            ws.sequence_order,
            ws.is_leaf_stage
        FROM workflow_stages ws
        INNER JOIN stage_tree st ON ws.id = st.parent_stage_id
    )
    SELECT * FROM stage_tree ORDER BY depth_level ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get next leaf stage in workflow
CREATE OR REPLACE FUNCTION get_next_leaf_stage(
    current_stage_id UUID,
    org_id UUID,
    item_sku TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    current_stage RECORD;
    next_stage_id UUID;
BEGIN
    -- Get current stage details
    SELECT * INTO current_stage
    FROM workflow_stages
    WHERE id = current_stage_id;
    
    -- Find next leaf stage
    -- This is a simplified version - you may need to adjust based on your specific requirements
    WITH all_leaf_stages AS (
        SELECT 
            ws.*,
            ROW_NUMBER() OVER (ORDER BY ws.sequence_order, ws.depth_level) as rn
        FROM workflow_stages ws
        WHERE ws.organization_id = org_id
        AND ws.is_leaf_stage = true
        AND (ws.sku = item_sku OR (ws.sku IS NULL AND item_sku IS NULL))
    ),
    current_position AS (
        SELECT rn
        FROM all_leaf_stages
        WHERE id = current_stage_id
    )
    SELECT id INTO next_stage_id
    FROM all_leaf_stages
    WHERE rn = (SELECT rn + 1 FROM current_position);
    
    RETURN next_stage_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Update RLS policies to handle tree structure
-- The existing RLS policies should continue to work as they filter by organization_id

-- Step 8: Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at on workflow_stages
DROP TRIGGER IF EXISTS update_workflow_stages_updated_at ON workflow_stages;
CREATE TRIGGER update_workflow_stages_updated_at
    BEFORE UPDATE ON workflow_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the migration
COMMENT ON TABLE workflow_stages IS 'Workflow stages with infinite nesting support via self-referencing tree structure. Migrated from two-level system.';
COMMENT ON COLUMN workflow_stages.parent_stage_id IS 'References parent stage for tree hierarchy. NULL for root stages.';
COMMENT ON COLUMN workflow_stages.depth_level IS 'Depth in the tree. 0 for root stages, increments for each level.';
COMMENT ON COLUMN workflow_stages.full_path IS 'Full path from root to this stage, e.g., "Plating > Copper > Vendor A Process"';
COMMENT ON COLUMN workflow_stages.is_leaf_stage IS 'True if stage has no children. Items can only be allocated to leaf stages.';
COMMENT ON COLUMN workflow_stages.sku IS 'SKU for SKU-specific workflows. NULL for organization-wide workflows.';