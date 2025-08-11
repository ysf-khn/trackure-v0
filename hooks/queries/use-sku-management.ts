import { useQuery } from "@tanstack/react-query";

interface SKUOrderRecord {
  sku: string;
  sku_name: string;
  order_id: string;
  order_number: string;
  buyer_id?: string;
  order_status: string;
  items_count_for_order: number;
  total_quantity_for_order: number;
  remaining_quantity_for_order: number;
  active_items_for_order: number;
  completed_items_for_order: number;
  active_template_id?: string;
  active_template_name?: string;
  template_description?: string;
  has_active_template: boolean;
  workflow_stages_count: number;
  leaf_stages_count: number;
  vendors_count: number;
  min_vendor_price?: number;
  avg_vendor_price?: number;
  max_vendor_price?: number;
  final_calculated_cost?: number;
  base_material_cost?: number;
  total_workflow_cost?: number;
  estimated_workflow_cost?: number;
  samples_count: number;
  order_created_at: string;
  last_movement?: string;
  template_usage_count?: number;
  template_avg_days?: number;
  parent_composite_sku?: string;
  is_component_item: boolean;
  sku_order_status: string;
  currency?: string;
  last_calculated_at?: string;
}

interface SKUManagementData {
  sku_orders: SKUOrderRecord[];
  stats: {
    total_sku_order_combinations: number;
    unique_skus: number;
    unique_orders: number;
    active_sku_order_combinations: number;
    avg_cost: number;
    total_active_items: number;
    total_estimated_workflow_cost: number;
    // Legacy fields for backward compatibility
    total_skus: number;
    active_skus: number;
    total_vendors: number;
  };
  // Legacy field for backward compatibility
  skus: SKUOrderRecord[];
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