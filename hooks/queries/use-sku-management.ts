import { useQuery } from "@tanstack/react-query";

interface SKUManagementData {
  skus: Array<{
    sku: string;
    sku_name?: string;
    active_items_count: number;
    completed_items_count: number;
    workflow_stages_count: number;
    vendors_count: number;
    samples_count: number;
    final_calculated_cost?: number;
    last_calculated_at?: string;
    last_movement?: string;
  }>;
  stats: {
    total_skus: number;
    active_skus: number;
    avg_cost?: number;
    total_active_items: number;
    total_vendors: number;
  };
}

export function useSKUManagement() {
  return useQuery<SKUManagementData>({
    queryKey: ["sku-management"],
    queryFn: async () => {
      const response = await fetch("/api/sku-management");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch SKU management data");
      }
      return response.json();
    },
  });
}