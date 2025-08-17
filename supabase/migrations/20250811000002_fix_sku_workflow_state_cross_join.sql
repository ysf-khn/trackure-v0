-- Fix the get_sku_workflow_state function to handle empty result sets properly
-- The original function had CROSS JOIN issues where empty CTEs would produce no results
-- This ensures the function always returns exactly one row with proper default values

CREATE OR REPLACE FUNCTION get_sku_workflow_state(
    p_sku TEXT,
    p_organization_id UUID
) 
RETURNS TABLE (
    has_active_items BOOLEAN,
    active_item_count INTEGER,
    active_items_in_workflow INTEGER,
    has_workflow_stages BOOLEAN,
    workflow_stage_count INTEGER,
    has_templates BOOLEAN,
    template_count INTEGER,
    active_template_id UUID,
    active_template_name TEXT,
    workflow_type TEXT,
    first_stage_id UUID,
    first_stage_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH active_items AS (
        -- Check for items with this SKU that are currently in workflow
        SELECT 
            COUNT(DISTINCT i.id) as item_count,
            COUNT(DISTINCT CASE WHEN i.status = 'In Workflow' THEN i.id END) as in_workflow_count
        FROM items i
        WHERE i.sku = p_sku
          AND i.organization_id = p_organization_id
          AND i.status IN ('New', 'In Workflow')
          AND NOT i.is_scrapped
    ),
    workflow_stages AS (
        -- Check if SKU-specific workflow stages exist
        -- Use dummy table to ensure exactly one row is always returned
        SELECT 
            COALESCE(COUNT(ws.id), 0) as stage_count,
            (ARRAY_AGG(ws.id ORDER BY ws.sequence_order) FILTER (WHERE ws.parent_stage_id IS NULL))[1] as first_stage_id,
            (ARRAY_AGG(ws.name ORDER BY ws.sequence_order) FILTER (WHERE ws.parent_stage_id IS NULL))[1] as first_stage_name,
            'sku' as workflow_type
        FROM (VALUES (1)) AS dummy(x)
        LEFT JOIN workflow_stages ws ON (
            ws.organization_id = p_organization_id
            AND ws.sku = p_sku  -- Only SKU-specific stages
        )
    ),
    templates AS (
        -- Check for available workflow templates
        -- Use dummy table to ensure exactly one row is always returned
        SELECT 
            COALESCE(COUNT(t.id), 0) as template_count,
            MAX(CASE WHEN t.is_active THEN t.id END) as active_template_id,
            MAX(CASE WHEN t.is_active THEN t.name END) as active_template_name
        FROM (VALUES (1)) AS dummy(x)
        LEFT JOIN workflow_templates t ON (
            t.sku = p_sku
            AND t.organization_id = p_organization_id
        )
    )
    SELECT 
        COALESCE(ai.item_count > 0, false) as has_active_items,
        COALESCE(ai.item_count, 0)::INTEGER as active_item_count,
        COALESCE(ai.in_workflow_count, 0)::INTEGER as active_items_in_workflow,
        COALESCE(ws.stage_count > 0, false) as has_workflow_stages,
        COALESCE(ws.stage_count, 0)::INTEGER as workflow_stage_count,
        COALESCE(t.template_count > 0, false) as has_templates,
        COALESCE(t.template_count, 0)::INTEGER as template_count,
        t.active_template_id,
        t.active_template_name,
        ws.workflow_type,
        ws.first_stage_id,
        ws.first_stage_name
    FROM active_items ai
    CROSS JOIN workflow_stages ws
    CROSS JOIN templates t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_sku_workflow_state TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_sku_workflow_state IS 
'Fixed version: Checks the current workflow state for a SKU including active items, existing workflow stages, and available templates. 
Uses dummy tables in CTEs to ensure CROSS JOIN always produces exactly one result row.
Used to determine the appropriate allocation strategy in the new-orders page.';