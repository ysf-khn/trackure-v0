-- Migration: Fix Item Completion Trigger for SKU-Level Workflows
-- Purpose: Update the completion trigger to work with SKU-specific completed stages
--          instead of organization-level completed stages
-- Background: The system has moved from org-level to SKU-level workflows,
--            but the completion trigger was still looking for org-level completed stages

-- Drop the old trigger first
DROP TRIGGER IF EXISTS check_item_completion_trigger ON public.item_stage_allocations;

-- Update the completion handler function for SKU-level workflows
CREATE OR REPLACE FUNCTION public.handle_item_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_completed_stage_id uuid;
    v_item_total_quantity integer;
    v_organization_id uuid;
    v_item_sku text;
    v_total_completed_quantity integer;
BEGIN
    -- Get the organization ID, total quantity, and SKU for this item
    SELECT organization_id, total_quantity, sku 
    INTO v_organization_id, v_item_total_quantity, v_item_sku
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

        RAISE NOTICE 'Item % completion check: Total: %, Completed: %, SKU: %', 
            NEW.item_id, v_item_total_quantity, v_total_completed_quantity, v_item_sku;

        -- Update remaining_quantity and status if all quantity is completed
        IF v_total_completed_quantity >= v_item_total_quantity THEN
            UPDATE public.items
            SET 
                remaining_quantity = 0,
                status = 'Completed',
                updated_at = now()
            WHERE id = NEW.item_id;

            RAISE NOTICE 'Item % marked as COMPLETED. Total: %, Completed: %, SKU: %', 
                NEW.item_id, v_item_total_quantity, v_total_completed_quantity, v_item_sku;
        ELSE
            -- Partial completion - update remaining quantity
            UPDATE public.items
            SET 
                remaining_quantity = v_item_total_quantity - v_total_completed_quantity,
                updated_at = now()
            WHERE id = NEW.item_id;

            RAISE NOTICE 'Item % partially completed. Total: %, Completed: %, Remaining: %, SKU: %', 
                NEW.item_id, v_item_total_quantity, v_total_completed_quantity, 
                (v_item_total_quantity - v_total_completed_quantity), v_item_sku;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER check_item_completion_trigger
    AFTER INSERT OR UPDATE ON public.item_stage_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_item_completion();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_item_completion() TO authenticated;

-- Update function comment
COMMENT ON FUNCTION public.handle_item_completion IS 'Updates item remaining_quantity and status when items reach SKU-specific "Completed" stages';

-- Optional: Fix any existing items that should be completed but aren't
-- This will check all items and update their status if they should be completed
DO $$
DECLARE
    item_record RECORD;
    v_completed_stage_id uuid;
    v_total_completed_quantity integer;
BEGIN
    RAISE NOTICE 'Checking existing items for completion status...';
    
    FOR item_record IN 
        SELECT i.id, i.organization_id, i.sku, i.total_quantity, i.status, i.remaining_quantity
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
            
            -- Update if all quantity is completed
            IF v_total_completed_quantity >= item_record.total_quantity THEN
                UPDATE items
                SET 
                    remaining_quantity = 0,
                    status = 'Completed',
                    updated_at = now()
                WHERE id = item_record.id;
                
                RAISE NOTICE 'Fixed item % - marked as COMPLETED (SKU: %)', item_record.id, item_record.sku;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Finished checking existing items for completion status';
END $$;