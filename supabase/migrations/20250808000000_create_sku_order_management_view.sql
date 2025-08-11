-- Migration: Create SKU-Order Management View
-- This migration creates a comprehensive view for managing SKUs at the order level

-- Create enhanced SKU-Order management view
CREATE OR REPLACE VIEW sku_order_management_view AS
SELECT 
    -- SKU and Order identification
    im.sku,
    im.organization_id,
    o.id as order_id,
    o.order_number,
    i.buyer_id,
    o.status as order_status,
    
    -- SKU basic info
    im.sku as sku_name,
    im.master_details as sku_description,
    
    -- Order-specific item metrics
    COUNT(DISTINCT i.id) as items_count_for_order,
    SUM(i.total_quantity) as total_quantity_for_order,
    SUM(i.remaining_quantity) as remaining_quantity_for_order,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status != 'Completed') as active_items_for_order,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'Completed') as completed_items_for_order,
    
    -- Template information
    wt.id as active_template_id,
    wt.name as active_template_name,
    wt.description as template_description,
    wt.is_active as has_active_template,
    
    -- Workflow information
    COUNT(DISTINCT ws.id) as workflow_stages_count,
    COUNT(DISTINCT ws.id) FILTER (WHERE ws.is_leaf_stage) as leaf_stages_count,
    
    -- Vendor information
    COUNT(DISTINCT vsp.vendor_id) as vendors_count,
    MIN(vsp.price) as min_vendor_price,
    AVG(vsp.price) as avg_vendor_price,
    MAX(vsp.price) as max_vendor_price,
    
    -- Cost information
    scc.final_calculated_cost,
    scc.base_material_cost,
    scc.total_workflow_cost,
    scc.markup_percentage,
    scc.currency,
    scc.last_calculated_at,
    
    -- Calculate estimated workflow cost for this order's quantities
    CASE 
        WHEN COUNT(DISTINCT vsp.vendor_id) > 0 THEN
            SUM(i.total_quantity) * COALESCE(AVG(vsp.price), 0)
        ELSE 0 
    END as estimated_workflow_cost,
    
    -- Sample information
    COUNT(DISTINCT s.id) as samples_count,
    
    -- Activity tracking
    o.created_at as order_created_at,
    MAX(i.created_at) as last_item_created,
    MAX(imh.moved_at) as last_movement,
    
    -- Template performance metrics
    wt.completed_count as template_usage_count,
    wt.avg_completion_days as template_avg_days,
    
    -- Composite item information
    i.parent_composite_sku,
    CASE WHEN i.parent_composite_sku IS NOT NULL THEN true ELSE false END as is_component_item,
    
    -- Status indicators
    CASE 
        WHEN COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'Completed') = COUNT(DISTINCT i.id) THEN 'All Completed'
        WHEN COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'Completed') > 0 THEN 'Partially Completed'
        WHEN COUNT(DISTINCT isa.id) > 0 THEN 'In Progress'
        ELSE 'Not Started'
    END as sku_order_status

FROM item_master im
-- Join with items for this specific order
INNER JOIN items i ON i.sku = im.sku AND i.organization_id = im.organization_id
INNER JOIN orders o ON o.id = i.order_id AND o.organization_id = im.organization_id

-- Template information (active template for this SKU)
LEFT JOIN workflow_templates wt ON wt.sku = im.sku 
    AND wt.organization_id = im.organization_id 
    AND wt.is_active = true

-- SKU cost calculations
LEFT JOIN sku_cost_calculations scc ON scc.sku = im.sku 
    AND scc.organization_id = im.organization_id 
    AND scc.is_active = true

-- Workflow stages for this SKU
LEFT JOIN workflow_stages ws ON ws.sku = im.sku 
    AND ws.organization_id = im.organization_id

-- Vendor stage pricing
LEFT JOIN vendor_stage_pricing vsp ON vsp.sku = im.sku 
    AND vsp.organization_id = im.organization_id 
    AND vsp.is_active = true

-- Samples for this SKU
LEFT JOIN samples s ON s.sku = im.sku 
    AND s.organization_id = im.organization_id

-- Item movements for activity tracking
LEFT JOIN item_movement_history imh ON imh.item_id = i.id

-- Item stage allocations to check progress
LEFT JOIN item_stage_allocations isa ON isa.item_id = i.id

GROUP BY 
    im.sku, im.organization_id, im.master_details,
    o.id, o.order_number, i.buyer_id, o.status, o.created_at,
    wt.id, wt.name, wt.description, wt.is_active, wt.completed_count, wt.avg_completion_days,
    scc.final_calculated_cost, scc.base_material_cost, scc.total_workflow_cost,
    scc.markup_percentage, scc.currency, scc.last_calculated_at,
    i.parent_composite_sku

ORDER BY o.created_at DESC, im.sku;

-- Grant access to the view
GRANT SELECT ON sku_order_management_view TO authenticated;

-- Add comments for documentation
COMMENT ON VIEW sku_order_management_view IS 'Comprehensive view showing SKU data at the order level with template and cost information';

-- Create function to get workflow cost estimation for a specific SKU-Order combination
CREATE OR REPLACE FUNCTION calculate_sku_order_workflow_cost(
    p_sku TEXT,
    p_order_id UUID,
    p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_total_cost DECIMAL(12, 2) := 0;
    v_cost_breakdown JSONB := '[]'::JSONB;
    v_stage RECORD;
    v_total_quantity INTEGER;
    v_currency TEXT := 'INR';
BEGIN
    -- Get total quantity for this SKU in this order
    SELECT SUM(total_quantity) INTO v_total_quantity
    FROM items
    WHERE sku = p_sku 
    AND order_id = p_order_id 
    AND organization_id = p_organization_id;
    
    IF v_total_quantity IS NULL OR v_total_quantity = 0 THEN
        RETURN jsonb_build_object(
            'total_cost', 0,
            'currency', v_currency,
            'quantity', 0,
            'cost_per_unit', 0,
            'stage_breakdown', '[]'::JSONB,
            'error', 'No items found for this SKU-Order combination'
        );
    END IF;
    
    -- Get workflow stages and their vendor pricing
    FOR v_stage IN
        SELECT 
            ws.name as stage_name,
            ws.id as stage_id,
            MIN(vsp.price) as min_price,
            AVG(vsp.price) as avg_price,
            MAX(vsp.price) as max_price,
            COUNT(vsp.vendor_id) as vendor_count,
            vsp.currency
        FROM workflow_stages ws
        LEFT JOIN vendor_stage_pricing vsp ON vsp.stage_id = ws.id 
            AND vsp.sku = p_sku 
            AND vsp.organization_id = p_organization_id
            AND vsp.is_active = true
        WHERE ws.sku = p_sku 
        AND ws.organization_id = p_organization_id
        AND ws.is_leaf_stage = true
        GROUP BY ws.id, ws.name, vsp.currency
        ORDER BY ws.sequence_order
    LOOP
        DECLARE
            v_stage_cost DECIMAL(12, 2);
            v_cost_per_unit DECIMAL(12, 2);
        BEGIN
            -- Use average price if multiple vendors, otherwise use available price
            v_cost_per_unit := COALESCE(v_stage.avg_price, 0);
            v_stage_cost := v_cost_per_unit * v_total_quantity;
            v_total_cost := v_total_cost + v_stage_cost;
            
            -- Update currency from first stage with pricing
            IF v_stage.currency IS NOT NULL THEN
                v_currency := v_stage.currency;
            END IF;
            
            -- Add to breakdown
            v_cost_breakdown := v_cost_breakdown || jsonb_build_object(
                'stage_id', v_stage.stage_id,
                'stage_name', v_stage.stage_name,
                'cost_per_unit', v_cost_per_unit,
                'total_stage_cost', v_stage_cost,
                'vendor_count', v_stage.vendor_count,
                'min_price', v_stage.min_price,
                'max_price', v_stage.max_price,
                'currency', COALESCE(v_stage.currency, v_currency)
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'total_cost', v_total_cost,
        'currency', v_currency,
        'quantity', v_total_quantity,
        'cost_per_unit', CASE WHEN v_total_quantity > 0 THEN v_total_cost / v_total_quantity ELSE 0 END,
        'stage_breakdown', v_cost_breakdown,
        'calculated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION calculate_sku_order_workflow_cost TO authenticated;

-- Add comment
COMMENT ON FUNCTION calculate_sku_order_workflow_cost IS 'Calculates estimated workflow cost for a specific SKU-Order combination based on current vendor pricing';