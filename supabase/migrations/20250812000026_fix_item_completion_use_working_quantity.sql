-- Fix item completion logic to use working_quantity instead of total_quantity
-- This ensures proper completion when items have been completely scrapped

CREATE OR REPLACE FUNCTION public.handle_item_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_completed_stage_id uuid;
    v_item_total_quantity integer;
    v_item_working_quantity integer;
    v_organization_id uuid;
    v_item_sku text;
    v_total_completed_quantity integer;
BEGIN
    -- Get the organization ID, quantities, and SKU for this item
    SELECT organization_id, total_quantity, working_quantity, sku 
    INTO v_organization_id, v_item_total_quantity, v_item_working_quantity, v_item_sku
    FROM public.items 
    WHERE id = NEW.item_id;

    IF v_item_sku IS NULL THEN
        RAISE NOTICE 'Item % has no SKU, skipping completion check', NEW.item_id;
        RETURN NEW;
    END IF;

    -- Get the SKU-specific "Completed" stage for this organization
    SELECT id INTO v_completed_stage_id
    FROM public.workflow_stages
    WHERE organization_id = v_organization_id 
    AND sku = v_item_sku
    AND name = 'Completed';

    IF v_completed_stage_id IS NULL THEN
        RAISE NOTICE 'No completed stage found for SKU % in organization %', v_item_sku, v_organization_id;
        RETURN NEW;
    END IF;

    -- Only proceed if we're moving TO the completed stage
    IF NEW.stage_id = v_completed_stage_id THEN
        -- Calculate total quantity in completed stage for this item
        SELECT COALESCE(SUM(quantity), 0) INTO v_total_completed_quantity
        FROM public.item_stage_allocations
        WHERE item_id = NEW.item_id AND stage_id = v_completed_stage_id;

        RAISE NOTICE 'Item % completion check: Total: %, Working: %, Completed: %, SKU: %', 
            NEW.item_id, v_item_total_quantity, v_item_working_quantity, v_total_completed_quantity, v_item_sku;

        -- KEY FIX: Use working_quantity instead of total_quantity for completion check
        IF v_total_completed_quantity >= v_item_working_quantity THEN
            UPDATE public.items
            SET 
                remaining_quantity = 0,                              -- Always 0 when completed
                allocated_quantity = working_quantity,               -- Ensure allocated = working when completed
                status = 'Completed',
                updated_at = now()
            WHERE id = NEW.item_id;

            RAISE NOTICE 'Item % marked as COMPLETED. Total: %, Working: %, Completed: %, SKU: %', 
                NEW.item_id, v_item_total_quantity, v_item_working_quantity, v_total_completed_quantity, v_item_sku;
        ELSE
            -- Partial completion - update remaining quantity based on working_quantity
            UPDATE public.items
            SET 
                remaining_quantity = v_item_working_quantity - v_total_completed_quantity,
                updated_at = now()
            WHERE id = NEW.item_id;

            RAISE NOTICE 'Item % partially completed. Total: %, Working: %, Completed: %, Remaining: %, SKU: %', 
                NEW.item_id, v_item_total_quantity, v_item_working_quantity, v_total_completed_quantity, 
                (v_item_working_quantity - v_total_completed_quantity), v_item_sku;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION public.handle_item_completion IS 'Updates item remaining_quantity and status when items reach SKU-specific "Completed" stages. Uses working_quantity (not total_quantity) for completion calculations to handle scrapped items correctly.';

-- Fix existing items that should be completed but aren't due to the previous logic
DO $$
DECLARE
    item_record RECORD;
    v_completed_stage_id uuid;
    v_total_completed_quantity integer;
BEGIN
    RAISE NOTICE 'Fixing existing items using working_quantity for completion...';
    
    FOR item_record IN 
        SELECT i.id, i.organization_id, i.sku, i.total_quantity, i.working_quantity, i.status, i.remaining_quantity
        FROM items i 
        WHERE i.status != 'Completed' AND i.sku IS NOT NULL
    LOOP
        -- Find the completed stage for this item's SKU
        SELECT id INTO v_completed_stage_id
        FROM workflow_stages
        WHERE organization_id = item_record.organization_id 
        AND sku = item_record.sku
        AND name = 'Completed';
        
        IF v_completed_stage_id IS NOT NULL THEN
            -- Calculate total quantity in completed stage
            SELECT COALESCE(SUM(quantity), 0) INTO v_total_completed_quantity
            FROM item_stage_allocations
            WHERE item_id = item_record.id AND stage_id = v_completed_stage_id;
            
            -- KEY FIX: Use working_quantity instead of total_quantity
            IF v_total_completed_quantity >= item_record.working_quantity THEN
                UPDATE items
                SET 
                    remaining_quantity = 0,                              -- Always 0 when completed
                    allocated_quantity = working_quantity,               -- Ensure allocated = working when completed
                    status = 'Completed',
                    updated_at = now()
                WHERE id = item_record.id;
                
                RAISE NOTICE 'Fixed item % - marked as COMPLETED using working_quantity (SKU: %, Working: %, Completed: %)', 
                    item_record.id, item_record.sku, item_record.working_quantity, v_total_completed_quantity;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Finished fixing existing items using working_quantity for completion';
END $$;