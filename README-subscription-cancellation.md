# Subscription Cancellation Implementation

This document explains how subscription cancellations are handled in Trackure to provide a standard user experience where customers retain access until their billing period ends.

## Overview

When a user cancels their subscription, they should continue to have access to the app until their current billing period expires. This is the standard practice in SaaS applications and provides better customer experience.

## Implementation Details

### 1. Webhook Handler Updates (`app/api/webhooks/dodo/route.ts`)

**Key Changes:**

- When `subscription.cancelled` event is received, we store the `access_expires_at` timestamp from the subscription's `next_billing_date`
- We **don't** immediately reset the user's onboarding status to `pending_subscription`
- The user metadata is updated with cancellation details but access is preserved

**Before:**

```javascript
// Immediate access revocation
subscription_status: "cancelled",
payment_status: "cancelled",
cancelled_at: new Date().toISOString(),
// Reset onboarding status immediately
updateProfileOnboardingStatus(userId, "pending_subscription");
```

**After:**

```javascript
// Preserve access until billing period ends
subscription_status: "cancelled",
payment_status: "cancelled",
cancelled_at: new Date().toISOString(),
access_expires_at: cancelledSubscription.next_billing_date, // Key addition
// Don't reset onboarding status until access expires
```

### 2. Middleware Updates (`utils/supabase/middleware.ts`)

Added logic to check if a cancelled subscription still has valid access:

```javascript
// Handle cancelled subscriptions that still have valid access
if (
  onboardingStatus === "pending_subscription" &&
  user.user_metadata?.subscription_status === "cancelled" &&
  user.user_metadata?.access_expires_at
) {
  const accessExpiresAt = new Date(user.user_metadata.access_expires_at);
  const now = new Date();

  // If access hasn't expired yet, treat as if subscription is still active
  if (accessExpiresAt > now) {
    if (user.user_metadata?.product_id && user.user_metadata?.payment_status) {
      onboardingStatus = "pending_profile";
    }
  }
}
```

### 3. Utility Function (`lib/utils.ts`)

Created `hasValidSubscriptionAccess()` function to centralize access checking logic:

```javascript
export function hasValidSubscriptionAccess(userMetadata: Record<string, any>): boolean {
  const subscriptionStatus = userMetadata?.subscription_status;
  const paymentStatus = userMetadata?.payment_status;

  // Active subscriptions have access
  if (subscriptionStatus === "active" && paymentStatus === "completed") {
    return true;
  }

  // Cancelled subscriptions with valid access period
  if (subscriptionStatus === "cancelled" && userMetadata?.access_expires_at) {
    const accessExpiresAt = new Date(userMetadata.access_expires_at);
    const now = new Date();
    return accessExpiresAt > now;
  }

  // Other subscription statuses (paused, on_hold) might still have access
  if (subscriptionStatus === "paused" || subscriptionStatus === "on_hold") {
    return paymentStatus === "completed";
  }

  return false;
}
```

### 4. Plan Limits Integration (`lib/plan-limits.ts`)

Updated to use the new utility function so cancelled users with valid access can still use the app within their plan limits.

### 5. Cleanup System

**API Endpoint:** `/api/subscription/cleanup`

- Provides a way to clean up expired cancelled subscriptions
- Should be called periodically (daily recommended)
- Updates user status from "cancelled" to "expired" when access period ends
- Resets onboarding status to require new subscription

**Cleanup Function:** `cleanupExpiredCancelledSubscriptions()`

- Exported from webhook handler for reuse
- Checks all users with cancelled subscriptions
- Updates metadata and onboarding status for expired access

### 6. UI Updates (`app/(app)/settings/billing/page.tsx`)

Enhanced the billing page to show clear messaging for cancelled subscriptions:

- Displays cancellation date
- Shows when access will expire (next billing date)
- Explains that they can reactivate anytime
- Uses warning styling instead of error styling

## Usage Flow

### Normal Cancellation Flow:

1. User cancels subscription through customer portal
2. Dodo Payments sends `subscription.cancelled` webhook
3. Webhook handler updates user metadata with `access_expires_at`
4. User continues to have access until expiry date
5. Scheduled cleanup job eventually updates status to "expired"

### Access Checking:

1. Middleware checks subscription status
2. If cancelled but not expired, treats as valid access
3. Plan limits and other features work normally
4. UI shows appropriate messaging about cancellation

## Scheduled Cleanup

To properly clean up expired subscriptions, set up a scheduled job to call:

```bash
curl -X POST https://your-domain.com/api/subscription/cleanup \
  -H "Authorization: Bearer your-internal-token"
```

**Recommended frequency:** Daily

## Environment Variables

Add to your `.env.local`:

```
INTERNAL_API_TOKEN=your-secure-random-token
```

This token is used to authenticate the cleanup endpoint.

## Testing

1. **Cancel a subscription** through the customer portal
2. **Verify user still has access** to the app
3. **Check billing page** shows proper cancellation messaging
4. **Test cleanup endpoint** by calling it manually
5. **Verify access is revoked** after cleanup runs on expired subscriptions

## Benefits

- **Better UX:** Users get value for their full billing period
- **Reduced support:** Clear messaging about when access expires
- **Standard practice:** Follows industry conventions
- **Flexibility:** Users can reactivate without losing their current period
