# Permissions Implementation Summary

This document outlines the comprehensive permissions system implemented throughout the Trackure application.

## Overview

The permissions system is built on a role-based access control (RBAC) model with two primary roles:

- **Owner**: Has full access to all features and can manage permissions
- **Worker**: Has configurable permissions based on organization settings

## Permission Categories

### 1. Workflow Management

- `workflow.view`: Can view workflow stages and structure (always enabled for workers)
- `workflow.edit`: Can add, edit, delete, and reorder workflow stages (owners only by default)

### 2. Item Management

- `items.view`: Can view item lists and details (always enabled for workers)
- `items.move`: Can move items forward and perform rework operations
- `items.add`: Can add new items to orders
- `items.delete`: Can delete items from orders (disabled by default)

### 3. Order Management

- `orders.view`: Can view order lists and details (always enabled for workers)
- `orders.create`: Can create new orders
- `orders.edit`: Can edit order details (disabled by default)
- `orders.payment_status`: Can update payment status of orders (owners only by default)

### 4. Documents & Downloads

- `documents.vouchers`: Can download movement and rework vouchers
- `documents.history`: Can view item movement history and generate history PDFs
- `documents.export`: Can export item and order data (disabled by default)

### 5. Team Management

- `team.view`: Can view team members and their roles
- `team.invite`: Can invite new team members (disabled by default)
- `team.edit`: Can edit team member details and roles (disabled by default)
- `team.remove`: Can remove team members (disabled by default)

### 6. Settings & Configuration

- `settings.account`: Can view and edit account settings (disabled by default)
- `settings.billing`: Can view and manage billing information (owners only by default)
- `settings.organization`: Can edit organization details (disabled by default)

## Implementation Details

### Frontend Components

#### 1. Order Management

- **New Order Page** (`app/(app)/orders/new/page.tsx`): Checks `orders.create` permission
- **Edit Order Form** (`components/orders/edit-order-form.tsx`): Checks `orders.edit` permission

#### 2. Team Management

- **Organization Settings** (`app/(app)/settings/organization/page.tsx`):
  - Checks `team.view` for viewing team members
  - Checks `team.invite` for inviting new members
  - Checks `team.remove` for removing members

#### 3. Navigation & UI

- **Navigation User Menu** (`components/nav-user.tsx`): Conditionally shows settings links based on permissions
- **Item Lists** (`components/items/item-list-table.tsx`): Controls action buttons based on permissions
- **Workflow Editor** (`components/settings/workflow-editor.tsx`): Checks `workflow.edit` permission

### Backend API Endpoints

#### 1. Order APIs

- **Create Order** (`app/api/orders/route.ts`): Checks `orders.create` permission for workers
- **Edit Order** (`app/api/orders/[orderId]/route.ts`): Checks `orders.edit` permission for workers
- **Payment Status** (`app/api/orders/[orderId]/payment-status/route.ts`): Checks `orders.payment_status` permission for workers

#### 2. Item APIs

- **Add Items** (`app/api/orders/[orderId]/items/route.ts`): Checks `items.add` permission for workers
- **Move Forward** (`app/api/items/move/forward/route.ts`): Checks `items.move` permission for workers
- **Rework** (`app/api/items/move/rework/route.ts`): Checks `items.move` permission for workers

#### 3. Team Management APIs

- **Invite Members** (`app/api/team/invites/route.ts`): Checks `team.invite` permission for workers
- **Remove Members** (`app/api/team/members/[memberId]/route.ts`): Checks `team.remove` permission for workers

#### 4. Document APIs

- **Export Items** (`app/api/items/export/route.ts`): Checks `documents.export` permission for workers
- **Export PDF** (`app/api/items/export-pdf/route.ts`): Checks `documents.export` permission for workers
- **Vouchers** (`app/api/vouchers/[itemId]/route.ts`): Checks `documents.vouchers` permission for workers
- **Item History PDF** (`app/api/items/[itemId]/history-pdf/route.ts`): Checks `documents.history` permission for workers

### Permission Management

#### Access Control Page

- **Location**: `app/(app)/settings/access-control/page.tsx`
- **Access**: Owner only
- **Features**:
  - View all permission categories and individual permissions
  - Toggle permissions for workers
  - Save changes to database
  - Reset to default settings

#### Database Integration

- **Hook**: `hooks/queries/use-worker-permissions.ts`
- **API**: `app/api/settings/access-control/route.ts`
- **Database Function**: `worker_has_permission(permission_key)`

## Permission Defaults

### Always Enabled (Cannot be disabled)

- `workflow.view`
- `items.view`
- `orders.view`
- `team.view`

### Enabled by Default

- `items.move`
- `items.add`
- `orders.create`
- `documents.vouchers`
- `documents.history`

### Disabled by Default

- `workflow.edit` (Owner only)
- `items.delete`
- `orders.edit`
- `orders.payment_status` (Owner only)
- `documents.export`
- `team.invite`
- `team.edit`
- `team.remove`
- `settings.account`
- `settings.billing` (Owner only)
- `settings.organization`

## Security Considerations

1. **Double Validation**: Permissions are checked both on the frontend (for UX) and backend (for security)
2. **Owner Bypass**: Owners always have all permissions regardless of settings
3. **Database Functions**: Permission checks use Supabase RPC functions for consistency
4. **Organization Scoping**: All permission checks are scoped to the user's organization
5. **Graceful Degradation**: UI elements are hidden/disabled when permissions are lacking

## Usage Examples

### Frontend Permission Check

```typescript
import useWorkerPermissions from "@/hooks/queries/use-worker-permissions";

const { hasPermission } = useWorkerPermissions();

// Check if user can create orders
if (hasPermission("orders.create")) {
  // Show create order button
}
```

### Backend Permission Check

```typescript
// Check if worker has permission
const { data: hasPermission, error: permissionError } = await supabase.rpc(
  "worker_has_permission",
  {
    permission_key: "orders.create",
  }
);

if (!hasPermission) {
  return NextResponse.json(
    { error: "Forbidden: You don't have permission to create orders" },
    { status: 403 }
  );
}
```

## Future Enhancements

1. **Granular Permissions**: Add more specific permissions (e.g., `orders.view.own` vs `orders.view.all`)
2. **Time-based Permissions**: Implement temporary permission grants
3. **Audit Logging**: Track permission changes and usage
4. **Role Templates**: Pre-defined permission sets for common roles
5. **Department-based Permissions**: Permissions based on organizational departments
