-- Fix allocation triggers to handle "Completed" stage specially
-- Items moved to "Completed" should not increase allocated_quantity

-- Update the insert trigger to skip "Completed" stage
CREATE OR REPLACE FUNCTION update_item_allocated_quantity_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
BEGIN
    -- Check if this is the "Completed" stage
    SELECT name INTO v_stage_name
    FROM workflow_stages
    WHERE id = NEW.stage_id;
    
    -- Don't increase allocated_quantity for Completed stage
    -- Completed items should not count as "allocated" in workflow
    IF v_stage_name != 'Completed' THEN
        UPDATE items 
        SET 
            allocated_quantity = allocated_quantity + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the update trigger to handle "Completed" stage transitions
CREATE OR REPLACE FUNCTION update_item_allocated_quantity_on_update()
RETURNS TRIGGER AS $$
DECLARE
    v_old_stage_name TEXT;
    v_new_stage_name TEXT;
BEGIN
    -- Only adjust if quantity actually changed
    IF OLD.quantity != NEW.quantity THEN
        -- Check stage names for both old and new stages
        SELECT name INTO v_old_stage_name
        FROM workflow_stages
        WHERE id = OLD.stage_id;
        
        SELECT name INTO v_new_stage_name  
        FROM workflow_stages
        WHERE id = NEW.stage_id;
        
        -- Handle different stage transition scenarios
        IF v_old_stage_name = 'Completed' AND v_new_stage_name != 'Completed' THEN
            -- Moving FROM Completed to regular stage: increase allocated_quantity
            UPDATE items 
            SET 
                allocated_quantity = allocated_quantity + (NEW.quantity - OLD.quantity),
                updated_at = NOW()
            WHERE id = NEW.item_id;
        ELSIF v_old_stage_name != 'Completed' AND v_new_stage_name = 'Completed' THEN
            -- Moving TO Completed from regular stage: don't change allocated_quantity here
            -- The completion trigger will handle this
            NULL;
        ELSIF v_old_stage_name != 'Completed' AND v_new_stage_name != 'Completed' THEN
            -- Regular stage-to-stage movement: normal behavior
            UPDATE items 
            SET 
                allocated_quantity = allocated_quantity + (NEW.quantity - OLD.quantity),
                updated_at = NOW()
            WHERE id = NEW.item_id;
        END IF;
        -- If both are Completed stage, do nothing (shouldn't happen)
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the delete trigger to handle "Completed" stage
CREATE OR REPLACE FUNCTION update_item_allocated_quantity_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
BEGIN
    -- Check if this was the "Completed" stage
    SELECT name INTO v_stage_name
    FROM workflow_stages
    WHERE id = OLD.stage_id;
    
    -- Don't decrease allocated_quantity for Completed stage
    -- Completed items weren't counted as "allocated" anyway
    IF v_stage_name != 'Completed' THEN
        UPDATE items 
        SET 
            allocated_quantity = allocated_quantity - OLD.quantity,
            updated_at = NOW()
        WHERE id = OLD.item_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_item_allocated_quantity_on_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION update_item_allocated_quantity_on_update() TO authenticated;
GRANT EXECUTE ON FUNCTION update_item_allocated_quantity_on_delete() TO authenticated;

-- Update comments
COMMENT ON FUNCTION update_item_allocated_quantity_on_insert() IS 'Updates allocated_quantity when allocations are created. Skips "Completed" stage since completed items are not considered allocated.';
COMMENT ON FUNCTION update_item_allocated_quantity_on_update() IS 'Updates allocated_quantity when allocations are modified. Handles transitions to/from "Completed" stage specially.';
COMMENT ON FUNCTION update_item_allocated_quantity_on_delete() IS 'Updates allocated_quantity when allocations are deleted. Skips "Completed" stage since completed items were not counted as allocated.';