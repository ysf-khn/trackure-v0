// Helper functions for optimizing Supabase queries

export const createOptimizedQuery = (client: any) => ({
  // Batch multiple queries into a single request when possible
  batchQuery: async (queries: (() => Promise<any>)[]) => {
    return Promise.all(queries.map((query) => query()));
  },

  // Add common query optimizations
  withOptimization: (query: any) => {
    return query
      .limit(1000) // Prevent accidental large queries
      .order("created_at", { ascending: false }); // Default ordering
  },

  // Helper for paginated queries
  paginate: (query: any, page: number = 1, limit: number = 50) => {
    const offset = (page - 1) * limit;
    return query.range(offset, offset + limit - 1);
  },

  // Helper for selecting only necessary columns
  selectOptimal: (query: any, columns: string[]) => {
    return query.select(columns.join(", "));
  },

  // Helper for adding caching headers to API responses
  withCacheHeaders: (response: any, maxAge: number = 300) => {
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    );
    return response;
  },
});

// Common query patterns for better performance
export const commonQueries = {
  // Get user profile with organization data in a single query
  getUserProfileWithOrg: (supabase: any, userId: string) => {
    return supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        full_name,
        avatar_url,
        organization_id,
        organizations!inner (
          id,
          name,
          slug
        )
      `
      )
      .eq("id", userId)
      .single();
  },

  // Get workflow stages with sub-stages count
  getWorkflowStagesOptimized: (supabase: any, organizationId: string) => {
    return supabase
      .from("workflow_stages")
      .select(
        `
        id,
        name,
        sequence_order,
        workflow_sub_stages (count)
      `
      )
      .eq("organization_id", organizationId)
      .order("sequence_order");
  },

  // Get items with minimal data for list views
  getItemsListOptimized: (supabase: any, organizationId: string) => {
    return supabase
      .from("items")
      .select(
        `
        id,
        sku,
        remaining_quantity,
        orders!inner (
          order_number
        )
      `
      )
      .eq("organization_id", organizationId)
      .limit(100); // Reasonable limit for list views
  },
};
