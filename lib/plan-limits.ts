import { createClient } from "@/utils/supabase/server";
import { getPlanLimitsByProductId, PlanLimits } from "./plans";

export interface UsageStats {
  currentUsers: number;
  currentActiveOrders: number;
  currentActiveItems: number;
}

export interface LimitCheckResult {
  withinLimits: boolean;
  limits: PlanLimits;
  usage: UsageStats;
  violations: {
    users?: boolean;
    orders?: boolean;
    items?: boolean;
  };
}

/**
 * Get current usage statistics for an organization
 */
export async function getOrganizationUsage(
  organizationId: string
): Promise<UsageStats> {
  const supabase = await createClient();

  // Get current user count
  const { count: userCount, error: userError } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (userError) {
    console.error("Error counting users:", userError);
    throw new Error("Failed to count organization users");
  }

  // Get current active orders count (orders with items that have remaining_quantity > 0)
  const { data: activeOrdersData, error: activeOrdersError } = await supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      items!inner(
        remaining_quantity
      )
    `
    )
    .eq("organization_id", organizationId)
    .gt("items.remaining_quantity", 0);

  if (activeOrdersError) {
    console.error("Error counting active orders:", activeOrdersError);
    throw new Error("Failed to count active orders");
  }

  // Get the "Completed" stage ID for this organization to exclude completed items
  const { data: completedStage } = await supabase
    .from("workflow_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "Completed")
    .single();

  const completedStageId = completedStage?.id;

  // Get current active items count (items not in completed stage)
  let activeItemsQuery = supabase
    .from("item_stage_allocations")
    .select("quantity", { count: "exact" })
    .eq("organization_id", organizationId);

  // Exclude completed stage if it exists
  if (completedStageId) {
    activeItemsQuery = activeItemsQuery.neq("stage_id", completedStageId);
  }

  const { data: activeItemsData, error: activeItemsError } =
    await activeItemsQuery;

  if (activeItemsError) {
    console.error("Error counting active items:", activeItemsError);
    throw new Error("Failed to count active items");
  }

  // Calculate total active items quantity
  const activeItemsCount =
    activeItemsData?.reduce((total, allocation) => {
      return total + allocation.quantity;
    }, 0) || 0;

  return {
    currentUsers: userCount || 0,
    currentActiveOrders: activeOrdersData?.length || 0,
    currentActiveItems: activeItemsCount,
  };
}

/**
 * Get user's subscription product ID
 */
export async function getUserSubscriptionProductId(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();

  // Get user's auth data to extract product_id from metadata
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.id !== userId) {
    // Try to get subscription details via API
    try {
      const response = await fetch("/api/subscription/details", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const subscription = await response.json();
      return subscription.product_id || null;
    } catch {
      return null;
    }
  }

  return user.user_metadata?.product_id || null;
}

/**
 * Check if organization is within plan limits
 */
export async function checkPlanLimits(
  organizationId: string,
  userId: string
): Promise<LimitCheckResult> {
  const [usage, productId] = await Promise.all([
    getOrganizationUsage(organizationId),
    getUserSubscriptionProductId(userId),
  ]);

  const limits = getPlanLimitsByProductId(productId);

  const violations = {
    users: usage.currentUsers > limits.maxUsers,
    orders: usage.currentActiveOrders > limits.maxActiveOrdersPerMonth,
    items: usage.currentActiveItems > limits.maxActiveItemsPerMonth,
  };

  const withinLimits =
    !violations.users && !violations.orders && !violations.items;

  return {
    withinLimits,
    limits,
    usage,
    violations,
  };
}

/**
 * Check if adding a user would exceed limits
 */
export async function canAddUser(
  organizationId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limitCheck = await checkPlanLimits(organizationId, userId);

  if (limitCheck.usage.currentUsers >= limitCheck.limits.maxUsers) {
    return {
      allowed: false,
      reason: `User limit exceeded. Your plan allows ${limitCheck.limits.maxUsers} users, and you currently have ${limitCheck.usage.currentUsers} users.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if adding an order would exceed limits
 */
export async function canAddOrder(
  organizationId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limitCheck = await checkPlanLimits(organizationId, userId);

  if (
    limitCheck.usage.currentActiveOrders >=
    limitCheck.limits.maxActiveOrdersPerMonth
  ) {
    return {
      allowed: false,
      reason: `Active order limit exceeded. Your plan allows ${limitCheck.limits.maxActiveOrdersPerMonth} active orders per month, and you currently have ${limitCheck.usage.currentActiveOrders} active orders.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if adding items would exceed limits
 */
export async function canAddItems(
  organizationId: string,
  userId: string,
  itemQuantity: number
): Promise<{ allowed: boolean; reason?: string }> {
  const limitCheck = await checkPlanLimits(organizationId, userId);

  if (
    limitCheck.usage.currentActiveItems + itemQuantity >
    limitCheck.limits.maxActiveItemsPerMonth
  ) {
    return {
      allowed: false,
      reason: `Active item limit would be exceeded. Your plan allows ${limitCheck.limits.maxActiveItemsPerMonth} active items per month. You currently have ${limitCheck.usage.currentActiveItems} active items, and adding ${itemQuantity} more would exceed the limit.`,
    };
  }

  return { allowed: true };
}
