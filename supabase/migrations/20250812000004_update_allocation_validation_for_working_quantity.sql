-- Update allocation validation to use working_quantity instead of total_quantity
-- This allows allocations to be validated against the workable quantity after scrapping

CREATE OR REPLACE FUNCTION public.validate_allocation_quantity()
RETURNS TRIGGER AS $$
DECLARE
    total_allocated integer;
    item_working_quantity integer;
BEGIN
    -- Calculate total allocated quantity for this item (including the new/updated allocation)
    SELECT COALESCE(SUM(quantity), 0) INTO total_allocated
    FROM public.item_stage_allocations
    WHERE item_id = NEW.item_id
    AND id != NEW.id; -- Exclude this allocation if it's an update
    
    total_allocated := total_allocated + NEW.quantity;
    
    -- Get the item's working quantity (not total_quantity)
    SELECT working_quantity INTO item_working_quantity
    FROM public.items
    WHERE id = NEW.item_id;
    
    -- Ensure allocated quantity doesn't exceed working quantity
    IF total_allocated > item_working_quantity THEN
        RAISE EXCEPTION 'Total allocated quantity (%) would exceed item working quantity (%). Item ID: %', 
            total_allocated, item_working_quantity, NEW.item_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger comment to reflect the change
COMMENT ON FUNCTION public.validate_allocation_quantity IS 'Validates that allocated quantities do not exceed item working_quantity (after scrapping).';