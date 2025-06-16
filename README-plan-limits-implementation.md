# Plan Limits Implementation

This document outlines the plan limits system that has been implemented to enforce usage restrictions based on subscription plans.

## Overview

The plan limits system enforces three main restrictions:

- **Users**: Maximum number of team members per organization
- **Active Orders**: Maximum number of orders with incomplete items per month
- **Active Items**: Maximum number of item quantities in non-completed workflow stages per month

## Plan Configuration

Plans are configured in `lib/plans.ts` with the following limits:

### ESSENTIALS Plan

- 3 Users (1 Owner, 2 Workers)
- 3 Active Orders per month
- 100 Active Items per month

### PROFESSIONAL Plan

- 10 Users (Configurable Owner/Worker Mix)
- 20 Active Orders per month
- 500 Active Items per month

### BUSINESS Plan

- 25 Users (Configurable Owner/Worker Mix)
- 75 Active Orders per month
- 2,000 Active Items per month

## Implementation Components

### 1. Core Logic (`lib/plan-limits.ts`)

**Key Functions:**

- `getOrganizationUsage()`: Calculates current usage statistics
- `checkPlanLimits()`: Compares usage against plan limits
- `canAddUser()`, `canAddOrder()`, `canAddItems()`: Pre-flight checks before operations

**Usage Calculation:**

- **Users**: Count of profiles in organization
- **Active Orders**: Orders with items that have `remaining_quantity > 0`
- **Active Items**: Sum of quantities in `item_stage_allocations` excluding "Completed" stage

### 2. API Integration

**Plan Limits Check Endpoint** (`app/api/plan-limits/check/route.ts`)

- `GET /api/plan-limits/check`: Returns current usage and limits for authenticated user's organization

**Enforcement Points:**

- `POST /api/orders`: Order creation blocked if limit exceeded
- `POST /api/orders/[orderId]/items`: Item creation blocked if limit exceeded
- `POST /api/team/invites`: User invitation blocked if limit exceeded

### 3. Frontend Hooks (`hooks/queries/use-plan-limits.ts`)

**`usePlanLimits()`**: React Query hook for fetching plan limit data
**`useLimitCheck()`**: Enhanced hook with computed limit warnings and helper functions

### 4. UI Components

**`components/plan-limits-alert.tsx`**: Alert component for limit warnings

- Shows current usage percentages
- Displays exceeded limits
- Provides upgrade call-to-action

**`components/settings/plan-usage-section.tsx`**: Settings page section

- Comprehensive usage dashboard
- Progress bars for each limit type
- Plan upgrade interface

## Error Handling

When limits are exceeded, APIs return:

- **Status Code**: `402 Payment Required`
- **Error Message**: Descriptive message explaining which limit was exceeded and current usage

## Usage Examples

### Check if user can be added

```typescript
const limitCheck = await canAddUser(organizationId, userId);
if (!limitCheck.allowed) {
  throw new Error(limitCheck.reason);
}
```

### Frontend limit checking

```typescript
const { canAddUser, canAddOrder, canAddItems, isNearUserLimit } =
  useLimitCheck();

if (!canAddUser) {
  // Show upgrade prompt
}
```

### Display plan usage

```tsx
import { PlanUsageSection } from "@/components/settings/plan-usage-section";
import { PlanLimitsAlert } from "@/components/plan-limits-alert";

// In billing settings page - comprehensive usage dashboard
<PlanUsageSection />

// In main dashboard - alert when approaching/exceeding limits
<PlanLimitsAlert />

// In settings page - alert when approaching/exceeding limits
<PlanLimitsAlert />
```

## Plan Usage Display Locations

The plan usage and limits are displayed in the following locations:

### 1. **Billing Settings Page** (`/settings/billing`)

- **Component**: `<PlanUsageSection />`
- **Features**: Comprehensive usage dashboard with progress bars
- **Shows**: Always visible with complete usage breakdown
- **Includes**: Current plan, usage percentages, upgrade prompts

### 2. **Main Dashboard** (`/dashboard`)

- **Component**: `<PlanLimitsAlert />`
- **Features**: Alert banner for limit warnings
- **Shows**: Only when approaching (80%+) or exceeding limits
- **Includes**: Critical usage warnings and upgrade CTA

### 3. **Settings Page** (`/settings`)

- **Component**: `<PlanLimitsAlert />`
- **Features**: Alert banner in settings context
- **Shows**: Only when approaching (80%+) or exceeding limits
- **Includes**: Plan limit warnings for administrators

### Alert Behavior

- **Hidden**: When all usage is below 80% of limits
- **Warning (80%+)**: Shows yellow warning with "Near Limit" badges
- **Critical (100%+)**: Shows red alert with "Exceeded" badges and upgrade prompt

## Database Considerations

The system relies on existing database structure:

- `profiles` table for user counting
- `orders` and `items` tables for order/item counting
- `item_stage_allocations` for active item tracking
- `workflow_stages` for identifying completed stages

## Future Enhancements

1. **Monthly Reset Logic**: Currently tracks current state, could add monthly usage tracking
2. **Grace Period**: Allow brief overages with warnings before hard limits
3. **Usage Analytics**: Historical usage tracking and trends
4. **Automatic Notifications**: Email alerts when approaching limits
5. **Plan Recommendations**: Suggest optimal plan based on usage patterns

## Testing

To test the plan limits:

1. Create test organization with known plan
2. Add users/orders/items up to limit
3. Verify next operation is blocked with 402 status
4. Check UI shows appropriate warnings and usage data
