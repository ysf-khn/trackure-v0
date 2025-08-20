/**
 * Centralized Cache Invalidation Utilities
 *
 * This file provides reusable cache invalidation functions that ensure consistent
 * and comprehensive cache updates across all mutations in the application.
 */

import { QueryClient } from "@tanstack/react-query";
import { queryKeys, queryKeyUtils } from "./query-keys";

/**
 * Configuration for cache invalidation behavior
 */
interface InvalidationConfig {
  /** Whether to remove queries from cache entirely before invalidating */
  forceRemove?: boolean;
  /** Whether to refetch all matching queries, even inactive ones */
  refetchAll?: boolean;
  /** Whether to trigger additional refetch patterns */
  aggressiveRefetch?: boolean;
  /** Whether to dispatch window focus event to trigger refetches */
  triggerWindowFocus?: boolean;
}

const DEFAULT_CONFIG: InvalidationConfig = {
  forceRemove: true,
  refetchAll: true,
  aggressiveRefetch: true,
  triggerWindowFocus: true,
};

/**
 * Invalidate all stage item counts for an organization
 * This is the most commonly needed invalidation after mutations
 */
export const invalidateStageItemCounts = (
  queryClient: QueryClient,
  organizationId: string | null,
  config: InvalidationConfig = DEFAULT_CONFIG
) => {
  console.log(
    "[CACHE INVALIDATION] Invalidating stage item counts for org:",
    organizationId
  );

  if (config.forceRemove) {
    // Remove all cached stage item counts first
    console.log("[CACHE INVALIDATION] Removing stage item counts cache");
    queryClient.removeQueries(
      queryKeyUtils.getAllStageItemCountsForOrg(organizationId)
    );
  }

  // Invalidate all stage item counts queries
  console.log("[CACHE INVALIDATION] Invalidating stage item counts queries");
  queryClient.invalidateQueries({
    ...queryKeyUtils.getAllStageItemCountsForOrg(organizationId),
    refetchType: config.refetchAll ? "all" : "active",
  });

  if (config.aggressiveRefetch) {
    // Force refetch common SKU patterns
    const commonSKUPatterns = [null, undefined, ""];
    commonSKUPatterns.forEach((sku) => {
      console.log(
        `[CACHE INVALIDATION] Force refetching stage counts for SKU: ${sku}`
      );
      queryClient.refetchQueries({
        queryKey: queryKeys.stageItemCounts(organizationId, sku ?? null),
        type: "all",
      });
    });
  }

  if (config.triggerWindowFocus) {
    // Trigger window focus event to activate refetchOnWindowFocus
    console.log("[CACHE INVALIDATION] Triggering window focus event");
    window.dispatchEvent(new Event("focus"));
  }
};

/**
 * Invalidate workflow-related queries
 */
export const invalidateWorkflowQueries = (
  queryClient: QueryClient,
  organizationId: string | null,
  config: InvalidationConfig = DEFAULT_CONFIG
) => {
  console.log(
    "[CACHE INVALIDATION] Invalidating workflow queries for org:",
    organizationId
  );

  const queriesToInvalidate = [
    queryKeys.workflowStructure(organizationId),
    queryKeys.workflowSidebar(),
  ];

  queriesToInvalidate.forEach((queryKey) => {
    if (config.forceRemove) {
      queryClient.removeQueries({ queryKey });
    }
    queryClient.invalidateQueries({
      queryKey,
      refetchType: config.refetchAll ? "all" : "active",
    });
  });
};

/**
 * Invalidate dashboard and analytics queries
 */
export const invalidateDashboardQueries = (
  queryClient: QueryClient,
  organizationId: string | null,
  config: InvalidationConfig = DEFAULT_CONFIG
) => {
  console.log(
    "[CACHE INVALIDATION] Invalidating dashboard queries for org:",
    organizationId
  );

  const queriesToInvalidate = [
    queryKeys.dashboardStats(organizationId),
    queryKeys.bottleneckItems(organizationId),
  ];

  queriesToInvalidate.forEach((queryKey) => {
    if (config.forceRemove) {
      queryClient.removeQueries({ queryKey });
    }
    queryClient.invalidateQueries({
      queryKey,
      refetchType: config.refetchAll ? "all" : "active",
    });
  });
};

/**
 * Invalidate item-related queries
 */
export const invalidateItemQueries = (
  queryClient: QueryClient,
  organizationId: string | null,
  config: InvalidationConfig = DEFAULT_CONFIG
) => {
  console.log(
    "[CACHE INVALIDATION] Invalidating item queries for org:",
    organizationId
  );

  const queriesToInvalidate = [
    queryKeys.newOrderItems(organizationId),
    queryKeys.newItemsCount(),
    queryKeys.completedItemsCount(),
  ];

  // Also invalidate items in stage queries (using predicate for partial matches)
  if (config.forceRemove) {
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === "itemsInStage" &&
        query.queryKey[1] === organizationId,
    });
  }

  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "itemsInStage" &&
      query.queryKey[1] === organizationId,
    refetchType: config.refetchAll ? "all" : "active",
  });

  queriesToInvalidate.forEach((queryKey) => {
    if (config.forceRemove) {
      queryClient.removeQueries({ queryKey });
    }
    queryClient.invalidateQueries({
      queryKey,
      refetchType: config.refetchAll ? "all" : "active",
    });
  });
};

/**
 * Comprehensive invalidation for major item operations (scrap, rework, move)
 * This invalidates all queries that could be affected by item state changes
 */
export const invalidateAllItemRelatedQueries = (
  queryClient: QueryClient,
  organizationId: string | null,
  config: InvalidationConfig = DEFAULT_CONFIG
) => {
  console.log(
    "[CACHE INVALIDATION] Performing comprehensive invalidation for org:",
    organizationId
  );

  // Invalidate all related query groups
  invalidateStageItemCounts(queryClient, organizationId, config);
  invalidateWorkflowQueries(queryClient, organizationId, config);
  invalidateDashboardQueries(queryClient, organizationId, config);
  invalidateItemQueries(queryClient, organizationId, config);

  console.log("[CACHE INVALIDATION] Comprehensive invalidation completed");
};

/**
 * Nuclear option: Reset all queries for an organization
 * Use this only when other invalidation methods fail
 */
export const resetAllQueriesForOrganization = (
  queryClient: QueryClient,
  organizationId: string | null
) => {
  console.warn(
    "[CACHE INVALIDATION] NUCLEAR: Resetting all queries for org:",
    organizationId
  );

  queryClient.resetQueries(queryKeyUtils.getAllForOrganization(organizationId));

  // Trigger window focus to activate refetches
  window.dispatchEvent(new Event("focus"));

  console.warn("[CACHE INVALIDATION] Nuclear reset completed");
};
