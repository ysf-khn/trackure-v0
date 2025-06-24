import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type {
  CompositeItemDefinitionWithComponents,
  CompositeItemsResponse,
  CompositeItemStatusResponse,
  CompositeItemStatus,
} from "@/types/composite-items";

// Hook to fetch all composite items for an organization
export function useCompositeItems(
  organizationId: string | null | undefined,
  options?: {
    page?: number;
    limit?: number;
    active_only?: boolean;
    search?: string;
  }
) {
  return useQuery({
    queryKey: ["composite-items", organizationId, options],
    queryFn: async (): Promise<CompositeItemsResponse> => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const params = new URLSearchParams();
      if (options?.page) params.append("page", options.page.toString());
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.active_only) params.append("active_only", "true");
      if (options?.search) params.append("search", options.search);

      const response = await fetch(`/api/composite-items?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch composite items");
      }

      return response.json();
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch a single composite item by ID
export function useCompositeItem(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ["composite-items", itemId],
    queryFn: async (): Promise<CompositeItemDefinitionWithComponents> => {
      if (!itemId) {
        throw new Error("Item ID is required");
      }

      const response = await fetch(`/api/composite-items/${itemId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch composite item");
      }

      const data = await response.json();
      return data.composite_item;
    },
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch composite item status/progress information
export function useCompositeItemStatus(
  organizationId: string | null | undefined,
  options?: {
    page?: number;
    limit?: number;
    order_id?: string;
    status?: "Not Started" | "In Progress" | "Completed";
    search?: string;
  }
) {
  return useQuery({
    queryKey: ["composite-items", "status", organizationId, options],
    queryFn: async (): Promise<CompositeItemStatusResponse> => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const params = new URLSearchParams();
      if (options?.page) params.append("page", options.page.toString());
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.order_id) params.append("order_id", options.order_id);
      if (options?.status) params.append("status", options.status);
      if (options?.search) params.append("search", options.search);

      const response = await fetch(`/api/composite-items/status?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch composite item status");
      }

      return response.json();
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get composite items for a specific order
export function useOrderCompositeItems(
  organizationId: string | null | undefined,
  orderId: string | null | undefined
) {
  return useCompositeItemStatus(organizationId, {
    order_id: orderId,
    limit: 100, // Get all for an order
  });
}

// Hook to fetch available SKUs that can be used as components
export function useAvailableComponentSkus(
  organizationId: string | null | undefined
) {
  return useQuery({
    queryKey: ["item-master", "component-skus", organizationId],
    queryFn: async (): Promise<{ sku: string; item_name: string }[]> => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const supabase = createClient();

      // Fetch non-composite items that can be used as components
      const { data, error } = await supabase
        .from("item_master")
        .select("sku, item_name")
        .eq("organization_id", organizationId)
        .eq("is_composite", false)
        .order("sku");

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
