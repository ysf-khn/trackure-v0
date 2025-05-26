-- Migration: Add Bottleneck Items Function
-- Purpose: Add function to efficiently fetch items waiting longest in their current stage

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
GRANT EXECUTE ON FUNCTION public.get_bottleneck_items(uuid, uuid, integer) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_bottleneck_items IS 'Returns detailed information about items that have been in their current stage the longest, ordered by time in stage descending'; 