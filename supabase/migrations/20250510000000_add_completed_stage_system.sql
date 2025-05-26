-- Migration: Add Completed Stage System
-- Purpose: This migration introduces a predefined "Completed" stage system
--          to mark the end of item lifecycle and update remaining quantities
-- Affected Tables/Columns:
--   - public.workflow_stages: Add system "Completed" stage
--   - public.items: Add functions to update remaining_quantity and status
-- Affected Functions:
--   - public.create_completed_stage_for_organization: CREATE FUNCTION
--   - public.handle_item_completion: CREATE FUNCTION
--   - public.check_item_completion_trigger: CREATE TRIGGER

-- Function to create a "Completed" stage for an organization
CREATE OR REPLACE FUNCTION public.create_completed_stage_for_organization(
    p_organization_id uuid
)
RETURNS uuid AS $$
DECLARE
    v_completed_stage_id uuid;
BEGIN
    -- Check if a "Completed" stage already exists for this organization
    SELECT id INTO v_completed_stage_id
    FROM public.workflow_stages
    WHERE organization_id = p_organization_id 
    AND name = 'Completed'
    AND is_default = false;

    IF v_completed_stage_id IS NOT NULL THEN
        -- Stage already exists, return its ID
        RETURN v_completed_stage_id;
    END IF;

    -- Create the "Completed" stage with a very high sequence order (100000)
    -- This ensures it will always be the last stage regardless of how many stages are added
    INSERT INTO public.workflow_stages (
        id,
        name,
        sequence_order,
        organization_id,
        is_default,
        created_at
    ) VALUES (
        uuid_generate_v4(),
        'Completed',
        100000,
        p_organization_id,
        false,
        now()
    ) RETURNING id INTO v_completed_stage_id;

    RETURN v_completed_stage_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle item completion logic
CREATE OR REPLACE FUNCTION public.handle_item_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_completed_stage_id uuid;
    v_item_total_quantity integer;
    v_organization_id uuid;
BEGIN
    -- Get the organization ID and total quantity for this item
    SELECT organization_id, total_quantity 
    INTO v_organization_id, v_item_total_quantity
    FROM public.items 
    WHERE id = NEW.item_id;

    -- Get the "Completed" stage for this organization
    SELECT id INTO v_completed_stage_id
    FROM public.workflow_stages
    WHERE organization_id = v_organization_id 
    AND name = 'Completed'
    AND is_default = false;

    -- Only proceed if we're moving TO the completed stage
    IF NEW.stage_id = v_completed_stage_id THEN
        -- Calculate total quantity in completed stage for this item
        DECLARE
            v_total_completed_quantity integer;
        BEGIN
            SELECT COALESCE(SUM(quantity), 0) INTO v_total_completed_quantity
            FROM public.item_stage_allocations
            WHERE item_id = NEW.item_id AND stage_id = v_completed_stage_id;

            -- Update remaining_quantity and status if all quantity is completed
            IF v_total_completed_quantity >= v_item_total_quantity THEN
                UPDATE public.items
                SET 
                    remaining_quantity = 0,
                    status = 'Completed',
                    updated_at = now()
                WHERE id = NEW.item_id;

                RAISE NOTICE 'Item % marked as completed. Total: %, Completed: %', 
                    NEW.item_id, v_item_total_quantity, v_total_completed_quantity;
            ELSE
                -- Partial completion - update remaining quantity
                UPDATE public.items
                SET 
                    remaining_quantity = v_item_total_quantity - v_total_completed_quantity,
                    updated_at = now()
                WHERE id = NEW.item_id;

                RAISE NOTICE 'Item % partially completed. Total: %, Completed: %, Remaining: %', 
                    NEW.item_id, v_item_total_quantity, v_total_completed_quantity, 
                    (v_item_total_quantity - v_total_completed_quantity);
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle item completion
CREATE TRIGGER check_item_completion_trigger
    AFTER INSERT OR UPDATE ON public.item_stage_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_item_completion();

-- Function to ensure all existing organizations have a "Completed" stage
CREATE OR REPLACE FUNCTION public.ensure_completed_stages_for_all_organizations()
RETURNS void AS $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN SELECT id FROM public.organizations LOOP
        PERFORM public.create_completed_stage_for_organization(org_record.id);
    END LOOP;
    
    RAISE NOTICE 'Ensured "Completed" stages exist for all organizations';
END;
$$ LANGUAGE plpgsql;

-- Create "Completed" stages for all existing organizations
SELECT public.ensure_completed_stages_for_all_organizations();

-- Create a trigger to automatically create "Completed" stage for new organizations
CREATE OR REPLACE FUNCTION public.auto_create_completed_stage_for_new_org()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a "Completed" stage for the new organization
    PERFORM public.create_completed_stage_for_organization(NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_completed_stage_trigger
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_completed_stage_for_new_org();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_completed_stage_for_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_item_completion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_completed_stages_for_all_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_create_completed_stage_for_new_org() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.create_completed_stage_for_organization IS 'Creates a "Completed" stage for an organization if it does not exist';
COMMENT ON FUNCTION public.handle_item_completion IS 'Updates item remaining_quantity and status when items reach the "Completed" stage';
COMMENT ON TRIGGER check_item_completion_trigger ON public.item_stage_allocations IS 'Automatically handles item completion when allocations are added to "Completed" stage';
COMMENT ON TRIGGER auto_create_completed_stage_trigger ON public.organizations IS 'Automatically creates a "Completed" stage for new organizations'; 