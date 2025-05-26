# Completed Stage System

This document explains how the automated completion system works in Trackure.

## Overview

The system automatically handles item lifecycle completion by:

1. **Creating a "Completed" stage** for each organization
2. **Automatically updating item status** when items reach the completed stage
3. **Tracking completion metrics** and displaying them in the sidebar
4. **Providing a dedicated view** for completed items

## System Components

### 1. Database Migration (20250510000000_add_completed_stage_system.sql)

This migration:

- Creates a `create_completed_stage_for_organization()` function
- Adds a `handle_item_completion()` trigger function
- Automatically creates "Completed" stages for all existing organizations
- Sets up triggers to auto-create completed stages for new organizations

### 2. Completed Stage Creation

```sql
-- Function automatically creates a "Completed" stage with:
-- - Name: "Completed"
-- - Sequence order: MAX(existing_sequence_order) + 10
-- - Organization-specific (not a default stage)
-- - Highest sequence order to ensure it's the final stage
```

### 3. Item Completion Logic

When items are moved to the "Completed" stage:

```sql
-- Trigger automatically:
-- 1. Calculates total completed quantity for the item
-- 2. Updates item.remaining_quantity = total_quantity - completed_quantity
-- 3. Sets item.status = 'Completed' when remaining_quantity = 0
-- 4. Logs completion timestamp in item.updated_at
```

### 4. Frontend Integration

#### Sidebar Integration

- Shows "Completed Items" link with count badge
- Uses green styling to indicate success
- Separate from regular workflow navigation

#### Completed Items Page

- Displays all completed items for the organization
- Shows completion timestamps and order information
- Provides links back to original orders

#### Workflow Filtering

- Regular workflow stages exclude "Completed" stages
- "Completed" stages don't appear in workflow navigation
- Items in completed stage don't count toward workflow stage totals

## Usage Flow

### Automatic Completion

1. User moves items through regular workflow stages
2. When items reach the final workflow stage, users can move them forward
3. System automatically moves items to "Completed" stage
4. Trigger updates item status and remaining quantity
5. Completed items appear in the dedicated completed items view

### Manual Completion

1. Users can manually move items to "Completed" stage
2. Same automatic status updates occur
3. Useful for handling exceptions or early completion

## Database Schema Changes

### New Functions

- `create_completed_stage_for_organization(uuid)` - Creates completed stage
- `handle_item_completion()` - Trigger function for status updates
- `ensure_completed_stages_for_all_organizations()` - Migration helper
- `auto_create_completed_stage_for_new_org()` - Auto-creation for new orgs

### New Triggers

- `check_item_completion_trigger` - ON item_stage_allocations
- `auto_create_completed_stage_trigger` - ON organizations

### Updated Behavior

- `items.remaining_quantity` - Automatically updated when items reach completion
- `items.status` - Set to 'Completed' when fully processed
- `items.updated_at` - Updated on completion

## API Integration

### Hooks

- `useCompletedItemsCount()` - Get count for sidebar badge
- Completed items are queried with `status = 'Completed'`

### Workflow Queries

- Regular workflow queries exclude stages named "Completed"
- Prevents completed stages from appearing in navigation
- Maintains separation between active workflow and completion tracking

## Benefits

1. **Clear Lifecycle Management**: Items have a definitive end state
2. **Automatic Status Tracking**: No manual intervention needed for completion
3. **Separate Completion View**: Completed items don't clutter workflow views
4. **Audit Trail**: Completion timestamps and history are preserved
5. **Scalable**: System works regardless of workflow complexity
6. **Organization Isolation**: Each org has its own completed stage

## Future Enhancements

Potential improvements:

- Completion analytics and reporting
- Bulk completion operations
- Completion notifications/webhooks
- Custom completion stages (e.g., "Shipped", "Delivered")
- Integration with order completion logic
