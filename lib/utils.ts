import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if user should have access to the app despite having a cancelled subscription
 * Returns true if subscription is active OR if cancelled but access hasn't expired yet
 */
export function hasValidSubscriptionAccess(
  userMetadata: Record<string, any>
): boolean {
  const subscriptionStatus = userMetadata?.subscription_status;
  const paymentStatus = userMetadata?.payment_status;
  const productId = userMetadata?.product_id;

  // If user has a product_id and completed payment, they should have access
  // This handles cases where subscription_status might not be synced to user metadata
  if (productId && paymentStatus === "completed") {
    return true;
  }

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

  // Paused and on_hold subscriptions still have access if payment was completed
  if (subscriptionStatus === "paused" || subscriptionStatus === "on_hold") {
    return paymentStatus === "completed";
  }

  // Failed and expired subscriptions do not have access
  if (subscriptionStatus === "failed" || subscriptionStatus === "expired") {
    return false;
  }

  // For any other status, check if payment is completed and there's a product_id
  // This provides a fallback for any new statuses that might be added
  if (productId && paymentStatus === "completed") {
    return true;
  }

  return false;
}
