-- Update move forward API logic to maintain allocated_quantity column
-- This ensures allocated_quantity stays in sync when items are moved between stages
-- Note: This creates helper functions since the main logic is in TypeScript API routes

-- Function to update allocated_quantity when allocation is created
CREATE OR REPLACE FUNCTION update_item_allocated_quantity_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Increase allocated_quantity when a new allocation is created
    UPDATE items 
    SET 
        allocated_quantity = allocated_quantity + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update allocated_quantity when allocation is updated
CREATE OR REPLACE FUNCTION update_item_allocated_quantity_on_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Adjust allocated_quantity based on quantity change
    IF OLD.quantity != NEW.quantity THEN
        UPDATE items 
        SET 
            allocated_quantity = allocated_quantity + (NEW.quantity - OLD.quantity),
            updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update allocated_quantity when allocation is deleted
CREATE OR REPLACE FUNCTION update_item_allocated_quantity_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrease allocated_quantity when allocation is deleted
    UPDATE items 
    SET 
        allocated_quantity = allocated_quantity - OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.item_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically maintain allocated_quantity
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_allocated_quantity_insert ON item_stage_allocations;
DROP TRIGGER IF EXISTS trigger_update_allocated_quantity_update ON item_stage_allocations;
DROP TRIGGER IF EXISTS trigger_update_allocated_quantity_delete ON item_stage_allocations;

-- Create the triggers
CREATE TRIGGER trigger_update_allocated_quantity_insert
    AFTER INSERT ON item_stage_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_item_allocated_quantity_on_insert();

CREATE TRIGGER trigger_update_allocated_quantity_update
    AFTER UPDATE ON item_stage_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_item_allocated_quantity_on_update();

CREATE TRIGGER trigger_update_allocated_quantity_delete
    AFTER DELETE ON item_stage_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_item_allocated_quantity_on_delete();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_item_allocated_quantity_on_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION update_item_allocated_quantity_on_update() TO authenticated;
GRANT EXECUTE ON FUNCTION update_item_allocated_quantity_on_delete() TO authenticated;

-- Add comments
COMMENT ON FUNCTION update_item_allocated_quantity_on_insert() IS 'Automatically updates items.allocated_quantity when new allocations are created';
COMMENT ON FUNCTION update_item_allocated_quantity_on_update() IS 'Automatically updates items.allocated_quantity when allocations are modified';
COMMENT ON FUNCTION update_item_allocated_quantity_on_delete() IS 'Automatically updates items.allocated_quantity when allocations are deleted';

-- Verify allocated_quantity consistency across existing data
-- This ensures any existing inconsistencies are corrected
UPDATE items 
SET allocated_quantity = COALESCE(
    (SELECT SUM(quantity) 
     FROM item_stage_allocations 
     WHERE item_id = items.id), 
    0
)
WHERE allocated_quantity != COALESCE(
    (SELECT SUM(quantity) 
     FROM item_stage_allocations 
     WHERE item_id = items.id), 
    0
);

-- Log how many items were corrected
DO $$
DECLARE
    corrected_count INTEGER;
BEGIN
    GET DIAGNOSTICS corrected_count = ROW_COUNT;
    RAISE NOTICE 'Corrected allocated_quantity for % items', corrected_count;
END $$;