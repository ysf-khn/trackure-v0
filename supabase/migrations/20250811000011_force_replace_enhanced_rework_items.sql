-- Force drop and recreate enhanced_rework_items function to ensure we use the fixed version
-- This addresses the issue where multiple versions across migrations may cause PostgreSQL to use the old problematic version

-- First, explicitly drop the function to ensure clean state
DROP FUNCTION IF EXISTS public.enhanced_rework_items(JSONB, TEXT, BOOLEAN);

-- Now recreate with the fixed implementation
CREATE OR REPLACE FUNCTION public.enhanced_rework_items(
    p_items JSONB,
    p_rework_reason TEXT,
    p_create_replacements BOOLEAN DEFAULT false
)
RETURNS TABLE (
    item_id UUID,
    action_type TEXT,
    new_stage_id UUID,
    replacement_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_item JSONB;
    v_result RECORD;
BEGIN
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            IF (v_item->>'rework_type') = 'scrapped' THEN
                -- Handle scrapping
                SELECT * INTO v_result
                FROM scrap_item_with_replacement(
                    (v_item->>'id')::UUID,
                    (v_item->>'quantity')::INTEGER,
                    p_rework_reason,
                    p_create_replacements,
                    true
                );
                
                RETURN QUERY SELECT
                    (v_item->>'id')::UUID,
                    'scrapped'::TEXT,
                    NULL::UUID,
                    v_result.replacement_item_id,
                    true,
                    v_result.message;
                    
            ELSIF (v_item->>'rework_type') = 'backward' THEN
                -- Handle backward movement
                -- First, check if item and allocation exist
                IF NOT EXISTS (
                    SELECT 1 FROM items WHERE id = (v_item->>'id')::UUID
                ) THEN
                    RETURN QUERY SELECT
                        (v_item->>'id')::UUID,
                        'backward'::TEXT,
                        NULL::UUID,
                        NULL::UUID,
                        false,
                        'Item not found';
                    CONTINUE;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM item_stage_allocations 
                    WHERE item_id = (v_item->>'id')::UUID
                ) THEN
                    RETURN QUERY SELECT
                        (v_item->>'id')::UUID,
                        'backward'::TEXT,
                        NULL::UUID,
                        NULL::UUID,
                        false,
                        'No allocation found for item';
                    CONTINUE;
                END IF;

                -- Get current allocation details
                DECLARE
                    v_current_stage_id UUID;
                    v_current_alloc_id UUID;
                    v_org_id UUID;
                    v_requested_quantity INTEGER;
                    v_current_quantity INTEGER;
                BEGIN
                    -- Get the current allocation - FIXED: Properly qualify all column references
                    SELECT 
                        isa.id,
                        isa.stage_id,
                        isa.quantity,
                        items_table.organization_id
                    INTO 
                        v_current_alloc_id,
                        v_current_stage_id,
                        v_current_quantity,
                        v_org_id
                    FROM item_stage_allocations isa
                    JOIN items items_table ON items_table.id = isa.item_id  -- FIXED: Use explicit alias
                    WHERE isa.item_id = (v_item->>'id')::UUID
                    ORDER BY isa.created_at DESC
                    LIMIT 1;

                    v_requested_quantity := COALESCE((v_item->>'quantity')::INTEGER, v_current_quantity);

                    -- Validate quantity
                    IF v_requested_quantity > v_current_quantity THEN
                        RETURN QUERY SELECT
                            (v_item->>'id')::UUID,
                            'backward'::TEXT,
                            NULL::UUID,
                            NULL::UUID,
                            false,
                            format('Requested quantity %s exceeds available quantity %s', 
                                   v_requested_quantity, v_current_quantity);
                        CONTINUE;
                    END IF;

                    -- Check if target allocation already exists
                    IF EXISTS (
                        SELECT 1 FROM item_stage_allocations
                        WHERE item_id = (v_item->>'id')::UUID
                        AND stage_id = (v_item->>'target_stage_id')::UUID
                        AND allocation_type = 'reworked'
                    ) THEN
                        -- Update existing reworked allocation
                        UPDATE item_stage_allocations
                        SET quantity = quantity + v_requested_quantity,
                            updated_at = NOW(),
                            moved_by = auth.uid()
                        WHERE item_id = (v_item->>'id')::UUID
                        AND stage_id = (v_item->>'target_stage_id')::UUID
                        AND allocation_type = 'reworked';
                    ELSE
                        -- Create new reworked allocation
                        INSERT INTO item_stage_allocations (
                            item_id,
                            stage_id,
                            quantity,
                            allocation_type,
                            organization_id,
                            moved_by,
                            created_at,
                            updated_at
                        ) VALUES (
                            (v_item->>'id')::UUID,
                            (v_item->>'target_stage_id')::UUID,
                            v_requested_quantity,
                            'reworked',
                            v_org_id,
                            auth.uid(),
                            NOW(),
                            NOW()
                        );
                    END IF;

                    -- Handle source allocation
                    IF v_requested_quantity = v_current_quantity THEN
                        -- Full rework - delete source allocation
                        DELETE FROM item_stage_allocations
                        WHERE id = v_current_alloc_id;
                    ELSE
                        -- Partial rework - reduce source allocation
                        UPDATE item_stage_allocations
                        SET quantity = quantity - v_requested_quantity,
                            updated_at = NOW()
                        WHERE id = v_current_alloc_id;
                    END IF;

                    -- Log the movement
                    INSERT INTO item_movement_history (
                        item_id,
                        from_stage_id,
                        to_stage_id,
                        quantity,
                        moved_at,
                        moved_by,
                        organization_id,
                        rework_type,
                        rework_reason
                    ) VALUES (
                        (v_item->>'id')::UUID,
                        v_current_stage_id,
                        (v_item->>'target_stage_id')::UUID,
                        v_requested_quantity,
                        NOW(),
                        auth.uid(),
                        v_org_id,
                        'backward',
                        p_rework_reason
                    );

                    RETURN QUERY SELECT
                        (v_item->>'id')::UUID,
                        'backward'::TEXT,
                        (v_item->>'target_stage_id')::UUID,
                        NULL::UUID,
                        true,
                        format('Successfully reworked %s items', v_requested_quantity);
                END;
                
            ELSE
                -- Unknown rework type
                RETURN QUERY SELECT
                    (v_item->>'id')::UUID,
                    COALESCE(v_item->>'rework_type', 'unknown')::TEXT,
                    NULL::UUID,
                    NULL::UUID,
                    false,
                    format('Unknown rework type: %s', v_item->>'rework_type');
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT
                (v_item->>'id')::UUID,
                COALESCE(v_item->>'rework_type', 'unknown')::TEXT,
                NULL::UUID,
                NULL::UUID,
                false,
                SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.enhanced_rework_items(JSONB, TEXT, BOOLEAN) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.enhanced_rework_items IS 'FORCE REPLACED: Processes multiple rework actions including backward movement and scrapping, with explicit column qualification to prevent ambiguity errors';