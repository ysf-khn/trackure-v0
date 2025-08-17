-- Simplify scrap function to use working_quantity directly
-- This eliminates complex workarounds and makes scrap logic straightforward

CREATE OR REPLACE FUNCTION scrap_item_with_replacement(
    p_item_id UUID,
    p_quantity INTEGER,
    p_scrap_reason TEXT,
    p_stage_id UUID,
    p_create_replacement BOOLEAN DEFAULT false,
    p_preserve_total_quantity BOOLEAN DEFAULT true -- Kept for API compatibility, but working_quantity behavior differs
)
RETURNS TABLE (
    scrapped_item_id UUID,
    replacement_item_id UUID,
    message TEXT
) AS $$
DECLARE
    v_item RECORD;
    v_current_allocation RECORD;
    v_new_replacement_id UUID;
    v_organization_id UUID;
    v_sku TEXT;
    v_order_id UUID;
    v_is_allocation_total_scrap BOOLEAN;
BEGIN
    -- Ensure transaction consistency
    SET LOCAL synchronous_commit = 'on';
    
    -- Get item details with FOR UPDATE to prevent concurrent modifications
    SELECT * INTO v_item
    FROM items
    WHERE id = p_item_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;
    
    IF v_item.is_scrapped THEN
        RAISE EXCEPTION 'Item is already scrapped';
    END IF;
    
    -- Validate that we have enough working quantity to scrap
    IF p_quantity > v_item.working_quantity THEN
        RAISE EXCEPTION 'Cannot scrap % items. Item only has % working quantity.', p_quantity, v_item.working_quantity;
    END IF;
    
    -- Get the SPECIFIC stage allocation to scrap from
    SELECT * INTO v_current_allocation
    FROM item_stage_allocations
    WHERE item_id = p_item_id
      AND stage_id = p_stage_id  
      AND quantity > 0
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No allocation found for item in the specified stage, or quantity is 0';
    END IF;
    
    IF p_quantity > v_current_allocation.quantity THEN
        RAISE EXCEPTION 'Cannot scrap % items. Only % available in this stage.', p_quantity, v_current_allocation.quantity;
    END IF;
    
    v_organization_id := v_item.organization_id;
    v_sku := v_item.sku;
    v_order_id := v_item.order_id;
    v_is_allocation_total_scrap := (p_quantity = v_current_allocation.quantity);
    
    -- Update the original item based on scrap mode
    IF p_create_replacement THEN
        -- Scrap & Replace Mode: Keep working_quantity same, create replacement items
        -- Reduce remaining_quantity to track completion progress
        IF p_quantity >= v_item.remaining_quantity THEN
            -- Full scrap - mark item as completed/scrapped
            UPDATE items 
            SET 
                remaining_quantity = 0,
                status = 'Completed',
                is_scrapped = true,
                scrapped_at = NOW(),
                scrapped_by = auth.uid(),
                scrapped_from_stage_id = p_stage_id,
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial scrap with replacement
            UPDATE items 
            SET 
                remaining_quantity = remaining_quantity - p_quantity,
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
        
        -- working_quantity stays the same in scrap & replace mode
    ELSE
        -- Complete Scrap Mode: Reduce working_quantity directly (the key change!)
        IF p_quantity >= v_item.working_quantity THEN
            -- Full scrap - reduce both working and remaining quantities to 0
            UPDATE items 
            SET 
                working_quantity = 0,
                remaining_quantity = 0,
                status = 'Completed',
                is_scrapped = true,
                scrapped_at = NOW(),
                scrapped_by = auth.uid(),
                scrapped_from_stage_id = p_stage_id,
                updated_at = NOW()
            WHERE id = p_item_id;
        ELSE
            -- Partial scrap - reduce both working and remaining quantities
            UPDATE items 
            SET 
                working_quantity = working_quantity - p_quantity,
                remaining_quantity = remaining_quantity - p_quantity,
                updated_at = NOW()
            WHERE id = p_item_id;
        END IF;
        
        -- For complete scrap, reduce order total by working quantity change
        UPDATE orders
        SET total_quantity = total_quantity - p_quantity
        WHERE id = v_order_id;
    END IF;
    
    scrapped_item_id := p_item_id;
    
    -- Handle stage allocation
    IF v_is_allocation_total_scrap THEN
        DELETE FROM item_stage_allocations
        WHERE id = v_current_allocation.id;
    ELSE
        UPDATE item_stage_allocations
        SET 
            quantity = quantity - p_quantity,
            updated_at = NOW()
        WHERE id = v_current_allocation.id;
    END IF;
    
    -- Log the scrap movement
    INSERT INTO item_movement_history (
        item_id,
        from_stage_id,
        to_stage_id,
        quantity,
        moved_at,
        moved_by,
        organization_id,
        rework_type,
        rework_reason,
        scrap_reason
    )
    VALUES (
        p_item_id,
        p_stage_id,
        NULL,
        p_quantity,
        NOW(),
        auth.uid(),
        v_organization_id,
        'scrapped',
        p_scrap_reason,
        p_scrap_reason
    );
    
    -- Create replacement item if requested (as normal items, no special tracking)
    IF p_create_replacement THEN
        INSERT INTO items (
            organization_id,
            order_id,
            sku,
            buyer_id,
            instance_details,
            total_quantity,
            working_quantity,      -- Set working_quantity equal to total_quantity
            remaining_quantity,
            status,
            -- Remove replacement tracking fields - these are just normal items
            created_at,
            updated_at
        )
        VALUES (
            v_organization_id,
            v_order_id,
            v_sku,
            v_item.buyer_id,
            v_item.instance_details,
            p_quantity,
            p_quantity,            -- working_quantity = total_quantity for new items
            p_quantity,
            'New',                 -- Just a normal new item
            NOW(),
            NOW()
        )
        RETURNING id INTO v_new_replacement_id;
        
        replacement_item_id := v_new_replacement_id;
        message := format('Scrapped %s units. Replacement item created as normal new item for allocation.', p_quantity);
    ELSE
        replacement_item_id := NULL;
        message := format('Scrapped %s units permanently. Working quantity reduced.', p_quantity);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION scrap_item_with_replacement(UUID, INTEGER, TEXT, UUID, BOOLEAN, BOOLEAN) IS 
'Simplified scrap function using working_quantity.
- Complete scrap: Reduces working_quantity directly  
- Scrap & replace: Creates normal new items (no special replacement tracking)
- Replacement items appear in new order items and can be allocated like any other items';

-- Also update the simpler old view that might still be referenced
CREATE OR REPLACE VIEW public.new_order_items AS
SELECT 
    i.id AS item_id,
    i.sku,
    i.buyer_id,
    i.total_quantity AS original_item_total_quantity,
    -- Use working_quantity instead of total_quantity for availability
    (i.working_quantity - COALESCE(sa.allocated_sum, 0)) AS quantity_in_new_pool,
    i.remaining_quantity,
    o.id AS order_id,
    o.order_number,
    o.customer_name,
    i.created_at,
    i.organization_id,
    i.status
FROM 
    public.items i
JOIN 
    public.orders o ON i.order_id = o.id
LEFT JOIN (
    SELECT 
        item_id, 
        SUM(quantity) AS allocated_sum
    FROM public.item_stage_allocations
    GROUP BY item_id
) sa ON i.id = sa.item_id
WHERE 
    i.status = 'New' 
    AND (i.working_quantity - COALESCE(sa.allocated_sum, 0)) > 0;