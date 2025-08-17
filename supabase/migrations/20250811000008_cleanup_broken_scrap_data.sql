-- Simple cleanup of broken scrap data - remove tracking artifacts only
-- The old broken scrap logic created extra tracking items causing quantity double-counting
-- This migration removes those artifacts without modifying original items

DO $$
DECLARE
    cleanup_record RECORD;
    items_removed INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting simple cleanup of broken scrap tracking items...';
    
    -- Find and remove scrapped items that appear to be tracking artifacts from the old broken logic
    -- These are items that were created as "scrapped" items with small quantities
    -- that should never have been created in the first place
    
    FOR cleanup_record IN (
        SELECT 
            i.id as tracking_item_id,
            i.sku,
            i.total_quantity,
            i.order_id,
            o.order_number,
            i.created_at
        FROM items i
        JOIN orders o ON i.order_id = o.id
        WHERE i.is_scrapped = true
          AND i.total_quantity > 0
          AND i.total_quantity <= 10  -- Small quantities that look like tracking amounts
          AND i.status = 'Completed'
          AND i.scrapped_at IS NOT NULL
          AND i.created_at > '2024-08-01'  -- Only recent items from broken logic
          -- Ensure there's another item with the same SKU in the same order (the original)
          AND EXISTS (
              SELECT 1 FROM items other
              WHERE other.order_id = i.order_id
                AND other.sku = i.sku
                AND other.id != i.id
                AND NOT COALESCE(other.is_scrapped, false)
                AND other.total_quantity > i.total_quantity
          )
        ORDER BY i.created_at DESC
    ) LOOP
        
        RAISE NOTICE 'Removing tracking artifact: Item % (SKU: %, Qty: %) from Order %', 
                    cleanup_record.tracking_item_id,
                    cleanup_record.sku, 
                    cleanup_record.total_quantity,
                    cleanup_record.order_number;
        
        -- Remove movement history for tracking artifacts (they were bogus records anyway)
        DELETE FROM item_movement_history
        WHERE item_id = cleanup_record.tracking_item_id;
        
        -- Remove any allocations for this tracking item
        DELETE FROM item_stage_allocations 
        WHERE item_id = cleanup_record.tracking_item_id;
        
        -- Clear any foreign key references to this tracking item
        UPDATE items 
        SET replaced_item_id = NULL 
        WHERE replaced_item_id = cleanup_record.tracking_item_id;
        
        -- Remove the tracking artifact item
        DELETE FROM items WHERE id = cleanup_record.tracking_item_id;
        
        items_removed := items_removed + 1;
        
    END LOOP;
    
    -- Clean up any remaining orphaned allocations
    DELETE FROM item_stage_allocations 
    WHERE item_id NOT IN (SELECT id FROM items);
    
    -- Recalculate order totals to ensure consistency
    UPDATE orders 
    SET total_quantity = (
        SELECT COALESCE(SUM(i.total_quantity), 0)
        FROM items i 
        WHERE i.order_id = orders.id
          AND NOT COALESCE(i.is_scrapped, false)
    )
    WHERE EXISTS (
        SELECT 1 FROM items 
        WHERE order_id = orders.id 
          AND updated_at > NOW() - INTERVAL '1 hour'
    );
    
    RAISE NOTICE 'Simple cleanup completed: % tracking items removed', items_removed;
    
    IF items_removed > 0 THEN
        RAISE NOTICE 'Tracking artifacts removed. The quantity display bug should be improved.';
        RAISE NOTICE 'Note: Original items were not modified due to constraints. Future scrap operations will use the fixed logic.';
    ELSE
        RAISE NOTICE 'No obvious tracking items found to clean up.';
    END IF;
    
    RAISE NOTICE 'Scrap functionality cleanup migration completed. The core scrap function has been fixed for future operations.';
    
END $$;