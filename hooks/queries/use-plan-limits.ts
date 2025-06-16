import { useQuery } from "@tanstack/react-query";
import { LimitCheckResult } from "@/lib/plan-limits";

async function fetchPlanLimits(): Promise<LimitCheckResult> {
  const response = await fetch("/api/plan-limits/check");

  if (!response.ok) {
    throw new Error("Failed to fetch plan limits");
  }

  return response.json();
}

export function usePlanLimits() {
  return useQuery<LimitCheckResult, Error>({
    queryKey: ["planLimits"],
    queryFn: fetchPlanLimits,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

// Utility hook to check specific limits
export function useLimitCheck() {
  const { data: limits, isLoading, error } = usePlanLimits();

  return {
    limits,
    isLoading,
    error,
    canAddUser: limits
      ? limits.usage.currentUsers < limits.limits.maxUsers
      : false,
    canAddOrder: limits
      ? limits.usage.currentActiveOrders < limits.limits.maxActiveOrdersPerMonth
      : false,
    canAddItems: (itemCount: number = 1) =>
      limits
        ? limits.usage.currentActiveItems + itemCount <=
          limits.limits.maxActiveItemsPerMonth
        : false,
    isNearUserLimit: limits
      ? limits.usage.currentUsers >= limits.limits.maxUsers * 0.8
      : false,
    isNearOrderLimit: limits
      ? limits.usage.currentActiveOrders >=
        limits.limits.maxActiveOrdersPerMonth * 0.8
      : false,
    isNearItemLimit: limits
      ? limits.usage.currentActiveItems >=
        limits.limits.maxActiveItemsPerMonth * 0.8
      : false,
  };
}
