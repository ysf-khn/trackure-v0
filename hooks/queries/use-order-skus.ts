import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface OrderSKU {
  sku: string;
  sku_name: string | null;
  total_quantity: number; // Now represents working_quantity (actual workable quantity after scrapping)
  completed_quantity: number;
}

const fetchOrderSKUs = async (
  organizationId: string,
  orderId: string
): Promise<OrderSKU[]> => {
  const supabase = await createClient();

  // First, get all items for this order
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select(
      `
      id,
      sku,
      working_quantity,
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

  // Get unique SKUs
  const uniqueSkus = [...new Set(items.map(item => item.sku))];
  
  // For each SKU, get the completed stage and count allocations
  const skuDataPromises = uniqueSkus.map(async (sku) => {
    // Find the completed stage for this SKU
    const { data: completedStage } = await supabase
      .from("workflow_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", "Completed")
      .eq("sku", sku)
      .single();
    
    // If no SKU-specific completed stage, try organization-level
    let completedStageId = completedStage?.id;
    if (!completedStageId) {
      const { data: orgCompletedStage } = await supabase
        .from("workflow_stages")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", "Completed")
        .is("sku", null)
        .single();
      completedStageId = orgCompletedStage?.id;
    }
    
    // Get items for this SKU
    const skuItems = items.filter(item => item.sku === sku);
    const itemIds = skuItems.map(item => item.id);
    
    // Calculate working quantity for this SKU (actual workable quantity after scrapping)
    const workingQuantity = skuItems.reduce((sum, item) => sum + (item.working_quantity || 0), 0);
    
    // Get completed quantity from allocations to the completed stage
    let completedQuantity = 0;
    if (completedStageId && itemIds.length > 0) {
      const { data: allocations } = await supabase
        .from("item_stage_allocations")
        .select("quantity")
        .in("item_id", itemIds)
        .eq("stage_id", completedStageId);
      
      completedQuantity = allocations?.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0) || 0;
    }
    
    return {
      sku,
      sku_name: null,
      total_quantity: workingQuantity, // Now represents working quantity
      completed_quantity: completedQuantity,
    };
  });
  
  const skuData = await Promise.all(skuDataPromises);

  // Get SKU names from item_master
  const { data: itemMasters, error: masterError } = await supabase
    .from("item_master")
    .select("sku, master_details")
    .eq("organization_id", organizationId)
    .in("sku", uniqueSkus);

  if (masterError) {
    console.error("Error fetching SKU names:", masterError);
  }

  // Add SKU names to the results
  const skuDataWithNames = skuData.map(skuInfo => {
    const master = itemMasters?.find(m => m.sku === skuInfo.sku);
    if (master) {
      const details = master.master_details as any;
      skuInfo.sku_name = details?.name || details?.item_name || master.sku;
    }
    return skuInfo;
  });

  return skuDataWithNames;
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