Example Scenario Walkthrough

Order Creation:

Create a record in orders table with total_quantity = 150 (100 urns + 50 altar tools)
Order status would initially be something like "In Progress"

Item Records:

Create TWO records in the items table:

Item 1: sku = 'URN-001', total_quantity = 100, remaining_quantity = 100
Item 2: sku = 'TOOL-001', total_quantity = 50, remaining_quantity = 50

Stage Allocation:

As items move into workflow stages, create records in item_stage_allocations:

Record 1: item_id = [URN-001's ID], stage_id = [Manufacturing Stage ID], quantity = 2
Record 2: item_id = [URN-001's ID], stage_id = [Cutting Stage ID], quantity = 5
Record 3: item_id = [URN-001's ID], stage_id = [Polishing Stage ID], quantity = 3
Record 4: item_id = [TOOL-001's ID], stage_id = [Coating Stage ID], quantity = 10

Movement History:

When items move between stages, create records in item_movement_history:

e.g., When 2 urns move from manufacturing to cutting:
from_stage_id = [Manufacturing ID]
to_stage_id = [Cutting ID]
quantity = 2

Completion Tracking:

As items complete the final stage, decrease their remaining_quantity in the items table
When an item's remaining_quantity reaches 0, it's fully processed
When ALL items in an order have remaining_quantity = 0, the order is complete

Implementation Notes

You'll need application logic to:

Update the remaining_quantity when items complete the final stage
Check if all items in an order are complete to mark the order as complete
Ensure the sum of quantities in item_stage_allocations for an item doesn't exceed its total_quantity

The validation trigger I included already helps with point #3 above.
You might want to add a trigger to automatically mark an order as complete when all its items' remaining_quantity reaches zero.

How It Works in Your Scenario

Creating an Order with Multiple Item Types:
sql-- Create order
INSERT INTO orders (organization_id, order_number, customer_name, total_quantity)
VALUES ('org-uuid', 'ORD-123', 'Temple Corp', 150);

-- Add items to order
INSERT INTO items (order_id, sku, buyer_id, total_quantity, remaining_quantity, organization_id)
VALUES
('order-uuid', 'URN-001', 'BUYER-URN-456', 100, 100, 'org-uuid'),
('order-uuid', 'TOOL-001', 'BUYER-TOOL-789', 50, 50, 'org-uuid');

Allocating Items to Different Stages:
sql-- Allocate urns to different stages
INSERT INTO item_stage_allocations (item_id, stage_id, quantity, organization_id)
VALUES
('urn-item-uuid', 'manufacturing-stage-uuid', 2, 'org-uuid'),
('urn-item-uuid', 'cutting-stage-uuid', 5, 'org-uuid'),
('urn-item-uuid', 'polishing-stage-uuid', 3, 'org-uuid');

-- Allocate tools to a stage
INSERT INTO item_stage_allocations (item_id, stage_id, quantity, organization_id)
VALUES ('tool-item-uuid', 'coating-stage-uuid', 10, 'org-uuid');

Moving Items Between Stages:
sql-- Move 2 urns from manufacturing to cutting
BEGIN;
-- Record the movement in history
INSERT INTO item_movement_history (
item_id, from_stage_id, to_stage_id, quantity, moved_by, organization_id
) VALUES (
'urn-item-uuid', 'manufacturing-stage-uuid', 'cutting-stage-uuid', 2, 'user-uuid', 'org-uuid'
);

-- Update the stage allocations
UPDATE item_stage_allocations
SET quantity = quantity - 2
WHERE item_id = 'urn-item-uuid' AND stage_id = 'manufacturing-stage-uuid';

UPDATE item_stage_allocations
SET quantity = quantity + 2
WHERE item_id = 'urn-item-uuid' AND stage_id = 'cutting-stage-uuid';
COMMIT;

Completing Items:
sql-- When items complete the final stage (e.g., 10 urns)
BEGIN;
-- Record the movement to completion
INSERT INTO item_movement_history (
item_id, from_stage_id, to_stage_id, quantity, moved_by, organization_id
) VALUES (
'urn-item-uuid', 'final-stage-uuid', NULL, 10, 'user-uuid', 'org-uuid'
);

-- Update the stage allocation
UPDATE item_stage_allocations
SET quantity = quantity - 10
WHERE item_id = 'urn-item-uuid' AND stage_id = 'final-stage-uuid';

-- Update the item's remaining quantity
UPDATE items
SET remaining_quantity = remaining_quantity - 10
WHERE id = 'urn-item-uuid';

-- Note: The order completion trigger will automatically run when remaining_quantity reaches 0
COMMIT;

This schema provides a robust foundation for tracking different items with various quantities through your production workflow, with proper buyer ID tracking and automatic order completion when all items finish processing.

Complete Order Lifecycle with Triggers

1. Order Creation
   When a new order is created with multiple items:
   sql-- Create order
   INSERT INTO orders (organization_id, order_number, customer_name, total_quantity)
   VALUES ('org-uuid', 'ORD-123', 'Temple Corp', 150);

-- Add items to order
INSERT INTO items (order_id, sku, buyer_id, total_quantity, remaining_quantity, organization_id)
VALUES
('order-uuid', 'URN-001', 'BUYER-URN-456', 100, 100, 'org-uuid'),
('order-uuid', 'TOOL-001', 'BUYER-TOOL-789', 50, 50, 'org-uuid');
No triggers fire yet - we're just setting up the initial data. 2. Initial Allocation to Workflow Stages
When items are first assigned to stages:
sql-- Allocate urns to different stages
INSERT INTO item_stage_allocations (item_id, stage_id, quantity, organization_id)
VALUES
('urn-item-uuid', 'manufacturing-stage-uuid', 90, 'org-uuid'),
('urn-item-uuid', 'quality-check-stage-uuid', 10, 'org-uuid');
Trigger: check_allocation_quantity

This trigger fires BEFORE INSERT
It validates that 90 + 10 = 100, which matches the total_quantity of URN-001
If someone tried to allocate more than 100 urns, the trigger would raise an exception

3. Moving Items Between Stages
   When moving items from one stage to another:
   sql-- Move 20 urns from manufacturing to cutting
   BEGIN;
   -- Update stage allocations
   UPDATE item_stage_allocations
   SET quantity = quantity - 20
   WHERE item_id = 'urn-item-uuid' AND stage_id = 'manufacturing-stage-uuid';
   -- This might result in zero quantity, so we might delete instead
   -- DELETE FROM item_stage_allocations
   -- WHERE item_id = 'urn-item-uuid' AND stage_id = 'manufacturing-stage-uuid' AND quantity = 0;
   -- Check if an allocation already exists for the destination stage
   INSERT INTO item_stage_allocations (item_id, stage_id, quantity, organization_id)
   VALUES ('urn-item-uuid', 'cutting-stage-uuid', 20, 'org-uuid')
   ON CONFLICT (item_id, stage_id) DO UPDATE
   SET quantity = item_stage_allocations.quantity + 20;
   -- Record the movement in history
   INSERT INTO item_movement_history (
   item_id, from_stage_id, to_stage_id, quantity, moved_by, organization_id
   ) VALUES (
   'urn-item-uuid', 'manufacturing-stage-uuid', 'cutting-stage-uuid', 20, 'user-uuid', 'org-uuid'
   );
   COMMIT;
   Triggers that fire:

handle_timestamp_update - Updates the updated_at timestamp for the item_stage_allocations
check_allocation_quantity - Validates that the destination stage's new total doesn't exceed the item's total_quantity

4. Completing Items in the Final Stage
   When items complete the final workflow stage:
   sqlBEGIN;
   -- Move 10 urns from final stage to completion (no stage)
   UPDATE item_stage_allocations
   SET quantity = quantity - 10
   WHERE item_id = 'urn-item-uuid' AND stage_id = 'final-stage-uuid';
   -- Record the movement to completion
   INSERT INTO item_movement_history (
   item_id, from_stage_id, to_stage_id, quantity, moved_by, organization_id
   ) VALUES (
   'urn-item-uuid', 'final-stage-uuid', NULL, 10, 'user-uuid', 'org-uuid'
   );
   -- Update the remaining quantity
   UPDATE items
   SET remaining_quantity = remaining_quantity - 10
   WHERE id = 'urn-item-uuid';
   COMMIT;
   Triggers that fire:

handle_timestamp_update - Updates the updated_at timestamp for both item_stage_allocations and items
check_order_completion - This important trigger fires after the items update IF the remaining_quantity changed from non-zero to zero

If ALL items in the order now have remaining_quantity = 0, it automatically updates the order status to 'Completed'

5. Order Status Updates Automatically
   When all items are complete:

The check_order_completion trigger fires automatically
It checks if ALL items for this order have remaining_quantity = 0
If so, it updates the order's status to 'Completed'
The handle_timestamp_update trigger then updates the order's updated_at timestamp

Trigger Summary

Timestamp Triggers

Purpose: Keep updated_at fields current
Tables affected: profiles, orders, items, item_stage_allocations
When: BEFORE UPDATE operations
Action: Sets updated_at to current timestamp

Allocation Validation Trigger

Purpose: Prevent over-allocation of items to stages
Tables affected: item_stage_allocations
When: BEFORE INSERT or UPDATE operations
Action: Verifies total allocated quantity doesn't exceed item's total_quantity

Order Completion Trigger

Purpose: Automatically mark orders as complete
Tables affected: items (trigger) and orders (updated by trigger)
When: AFTER UPDATE of items.remaining_quantity to zero
Action: Checks if all items in the order are complete and updates order status

These triggers work together to maintain data integrity and automate business processes. The schema is designed to handle the complete lifecycle of orders with multiple item types moving through various workflow stages with different quantities at different times.
