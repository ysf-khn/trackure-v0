-- Migration: Add Dashboard Statistics Functions
-- Purpose: Add functions to calculate dashboard metrics efficiently

-- Function to get count of items in rework
-- Items are considered in rework if their most recent movement history entry has a rework_reason
CREATE OR REPLACE FUNCTION public.get_items_in_rework(org_id uuid)
RETURNS integer AS $$
DECLARE
    rework_count integer;
BEGIN
    -- Get count of items whose most recent movement has a rework_reason
    WITH latest_movements AS (
        SELECT DISTINCT ON (item_id) 
            item_id,
            rework_reason
        FROM public.item_movement_history
        WHERE organization_id = org_id
        ORDER BY item_id, moved_at DESC
    )
    SELECT COUNT(*)::integer INTO rework_count
    FROM latest_movements
    WHERE rework_reason IS NOT NULL AND rework_reason != '';
    
    RETURN COALESCE(rework_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get count of items waiting over 7 days
-- Items are considered waiting if they're not in the completed stage and their current stage entry is > 7 days old
CREATE OR REPLACE FUNCTION public.get_items_waiting_over_7_days(
    org_id uuid,
    completed_stage_id uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
    waiting_count integer;
BEGIN
    -- Get count of items (quantities) that have been in their current stage for > 7 days
    -- and are not in the completed stage
    WITH current_stage_entries AS (
        SELECT DISTINCT ON (isa.item_id, isa.stage_id, isa.sub_stage_id)
            isa.item_id,
            isa.stage_id,
            isa.sub_stage_id,
            isa.quantity,
            imh.moved_at as stage_entry_time
        FROM public.item_stage_allocations isa
        LEFT JOIN public.item_movement_history imh ON (
            imh.item_id = isa.item_id 
            AND imh.to_stage_id = isa.stage_id 
            AND (imh.to_sub_stage_id = isa.sub_stage_id OR (imh.to_sub_stage_id IS NULL AND isa.sub_stage_id IS NULL))
        )
        WHERE isa.organization_id = org_id
        AND (completed_stage_id IS NULL OR isa.stage_id != completed_stage_id)
        ORDER BY isa.item_id, isa.stage_id, isa.sub_stage_id, imh.moved_at DESC
    )
    SELECT COALESCE(SUM(quantity), 0)::integer INTO waiting_count
    FROM current_stage_entries
    WHERE stage_entry_time IS NOT NULL 
    AND stage_entry_time < (NOW() - INTERVAL '7 days');
    
    RETURN COALESCE(waiting_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bottleneck items (items waiting longest in their current stage)
-- Returns detailed information about items that have been in their current stage the longest
CREATE OR REPLACE FUNCTION public.get_bottleneck_items(
    org_id uuid,
    completed_stage_id uuid DEFAULT NULL,
    item_limit integer DEFAULT 10
)
RETURNS TABLE (
    item_id uuid,
    sku text,
    order_number text,
    current_stage_name text,
    current_sub_stage_name text,
    time_in_current_stage text,
    stage_entry_time timestamptz,
    quantity integer
) AS $$
BEGIN
    RETURN QUERY
    WITH current_stage_entries AS (
        -- Get the most recent movement history entry for each item allocation
        SELECT DISTINCT ON (isa.item_id, isa.stage_id, isa.sub_stage_id)
            isa.item_id,
            isa.stage_id,
            isa.sub_stage_id,
            isa.quantity,
            COALESCE(imh.moved_at, isa.created_at) as stage_entry_time,
            i.sku,
            o.order_number,
            ws.name as stage_name,
            wss.name as sub_stage_name
        FROM public.item_stage_allocations isa
        INNER JOIN public.items i ON i.id = isa.item_id
        INNER JOIN public.orders o ON o.id = i.order_id
        INNER JOIN public.workflow_stages ws ON ws.id = isa.stage_id
        LEFT JOIN public.workflow_sub_stages wss ON wss.id = isa.sub_stage_id
        LEFT JOIN public.item_movement_history imh ON (
            imh.item_id = isa.item_id 
            AND imh.to_stage_id = isa.stage_id 
            AND (imh.to_sub_stage_id = isa.sub_stage_id OR (imh.to_sub_stage_id IS NULL AND isa.sub_stage_id IS NULL))
        )
        WHERE isa.organization_id = org_id
        AND (completed_stage_id IS NULL OR isa.stage_id != completed_stage_id)
        ORDER BY isa.item_id, isa.stage_id, isa.sub_stage_id, imh.moved_at DESC
    ),
    time_calculations AS (
        SELECT 
            cse.*,
            EXTRACT(EPOCH FROM (NOW() - cse.stage_entry_time)) as seconds_in_stage
        FROM current_stage_entries cse
        WHERE cse.stage_entry_time IS NOT NULL
    )
    SELECT 
        tc.item_id,
        tc.sku,
        tc.order_number,
        tc.stage_name,
        tc.sub_stage_name,
        CASE 
            WHEN tc.seconds_in_stage >= 86400 THEN 
                CASE 
                    WHEN FLOOR(tc.seconds_in_stage / 86400) = 1 THEN '1 day'
                    ELSE FLOOR(tc.seconds_in_stage / 86400)::text || ' days'
                END
            WHEN tc.seconds_in_stage >= 3600 THEN 
                CASE 
                    WHEN FLOOR(tc.seconds_in_stage / 3600) = 1 THEN '1 hour'
                    ELSE FLOOR(tc.seconds_in_stage / 3600)::text || ' hours'
                END
            ELSE '< 1 hour'
        END as time_in_current_stage,
        tc.stage_entry_time,
        tc.quantity
    FROM time_calculations tc
    ORDER BY tc.seconds_in_stage DESC
    LIMIT item_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_items_in_rework(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_items_waiting_over_7_days(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bottleneck_items(uuid, uuid, integer) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_items_in_rework IS 'Returns count of items whose most recent movement history entry has a rework_reason';
COMMENT ON FUNCTION public.get_items_waiting_over_7_days IS 'Returns count of item quantities that have been in their current stage for more than 7 days (excluding completed stage)';
COMMENT ON FUNCTION public.get_bottleneck_items IS 'Returns detailed information about items that have been in their current stage the longest, ordered by time in stage descending'; 