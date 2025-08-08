import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface OrderSKU {
  sku: string;
  sku_name: string | null;
  total_quantity: number;
  completed_quantity: number;
}

const fetchOrderSKUs = async (
  organizationId: string,
  orderId: string
): Promise<OrderSKU[]> => {
  const supabase = await createClient();

  // Get all items for this order grouped by SKU
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select(
      `
      sku,
      total_quantity,
      status
    `
    )
    .eq("organization_id", organizationId)
    .eq("order_id", orderId);

  if (itemsError) {
    console.error("Error fetching order SKUs:", itemsError);
    throw new Error(itemsError.message);
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Group by SKU and calculate totals
  const skuMap = items.reduce((acc, item) => {
    if (!acc[item.sku]) {
      acc[item.sku] = {
        sku: item.sku,
        sku_name: null,
        total_quantity: 0,
        completed_quantity: 0,
      };
    }
    acc[item.sku].total_quantity += item.total_quantity;
    if (item.status === "Completed") {
      acc[item.sku].completed_quantity += item.total_quantity;
    }
    return acc;
  }, {} as Record<string, OrderSKU>);

  // Get SKU names from item_master
  const skus = Object.keys(skuMap);
  const { data: itemMasters, error: masterError } = await supabase
    .from("item_master")
    .select("sku, master_details")
    .eq("organization_id", organizationId)
    .in("sku", skus);

  if (masterError) {
    console.error("Error fetching SKU names:", masterError);
  }

  // Add SKU names to the results
  itemMasters?.forEach((master) => {
    if (skuMap[master.sku]) {
      const details = master.master_details as any;
      skuMap[master.sku].sku_name = details?.name || details?.item_name || master.sku;
    }
  });

  return Object.values(skuMap);
};

export const useOrderSKUs = (
  organizationId: string | undefined | null,
  orderId: string | null
) => {
  return useQuery<OrderSKU[], Error>({
    queryKey: ["orderSKUs", organizationId, orderId],
    queryFn: () => {
      if (!organizationId || !orderId) {
        return Promise.resolve([]);
      }
      return fetchOrderSKUs(organizationId, orderId);
    },
    enabled: !!organizationId && !!orderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};