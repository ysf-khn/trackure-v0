/**
 * Centralized Query Key Factory
 * 
 * This file defines all query keys used throughout the application to ensure consistency
 * and prevent cache invalidation mismatches. All components should import and use these
 * standardized query keys instead of creating their own.
 */

export const queryKeys = {
  // Stage item counts for sidebar badges
  stageItemCounts: (organizationId: string | null, selectedSKU: string | null) => 
    ["stage-item-counts", organizationId, selectedSKU] as const,

  // Items in specific stages
  itemsInStage: (organizationId: string | null, stageId?: string, selectedSKU?: string | null) => 
    ["itemsInStage", organizationId, stageId, selectedSKU] as const,

  // Workflow structure
  workflowStructure: (organizationId: string | null) => 
    ["workflow", "structure", organizationId] as const,

  workflowSidebar: () => 
    ["workflow", "sidebar"] as const,

  // Dashboard and analytics
  dashboardStats: (organizationId: string | null) => 
    ["dashboard", "stats", organizationId] as const,

  bottleneckItems: (organizationId: string | null) => 
    ["bottleneck", organizationId] as const,

  // Items and orders
  newOrderItems: (organizationId: string | null) => 
    ["newOrderItems", organizationId] as const,

  newItemsCount: () => 
    ["newItemsCount"] as const,

  completedItemsCount: () => 
    ["completedItemsCount"] as const,

  // User and organization
  profileAndOrg: () => 
    ["profileAndOrg"] as const,

  // SKUs
  skus: (organizationId: string | null) => 
    ["skus", organizationId] as const,

  // Permissions
  workerPermissions: (userId: string | null) => 
    ["worker-permissions", userId] as const,

  // Plan limits
  planLimits: (organizationId: string | null) => 
    ["plan-limits", organizationId] as const,

  // Samples
  samples: (organizationId: string | null) => 
    ["samples", organizationId] as const,

  // Vendors
  vendors: (organizationId: string | null) => 
    ["vendors", organizationId] as const,
} as const;

/**
 * Utility functions for query key operations
 */
export const queryKeyUtils = {
  /**
   * Check if a query key matches a specific pattern
   */
  matchesPattern: (queryKey: readonly unknown[], pattern: readonly unknown[]): boolean => {
    if (queryKey.length !== pattern.length) return false;
    return pattern.every((part, index) => part === null || part === queryKey[index]);
  },

  /**
   * Get all stage item counts variations for an organization
   */
  getAllStageItemCountsForOrg: (organizationId: string | null) => ({
    predicate: (query: { queryKey: readonly unknown[] }) => 
      query.queryKey[0] === "stage-item-counts" && 
      query.queryKey[1] === organizationId
  }),

  /**
   * Get all queries for an organization
   */
  getAllForOrganization: (organizationId: string | null) => ({
    predicate: (query: { queryKey: readonly unknown[] }) => 
      query.queryKey.includes(organizationId)
  }),
} as const;