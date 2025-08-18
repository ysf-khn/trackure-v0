"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

export interface SidebarSkuCost {
  totalCost: number;
  totalQuantity: number;
  currency: string;
  hasMultipleCurrencies: boolean;
  leafStagesWithPricing: number;
}

async function fetchSidebarSkuCost(
  organizationId: string,
  selectedSKU: string,
  selectedOrderId: string
): Promise<SidebarSkuCost> {
  console.log(`[COST DEBUG] Starting cost calculation for SKU: ${selectedSKU}, Order: ${selectedOrderId}, Org: ${organizationId}`);
  
  const supabase = createClient();

  // Get all leaf stages for the selected SKU
  const { data: leafStages, error: stagesError } = await supabase
    .from("workflow_stages")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("sku", selectedSKU)
    .eq("is_leaf_stage", true)
    .order("sequence_order");

  console.log(`[COST DEBUG] Leaf stages found:`, leafStages?.map(s => ({ id: s.id, name: s.name })) || []);
  console.log(`[COST DEBUG] Leaf stages count: ${leafStages?.length || 0}`);

  if (stagesError) {
    console.error("Error fetching leaf stages:", stagesError);
    throw new Error(stagesError.message);
  }

  if (!leafStages || leafStages.length === 0) {
    return {
      totalCost: 0,
      totalQuantity: 0,
      currency: "INR",
      hasMultipleCurrencies: false,
      leafStagesWithPricing: 0,
    };
  }

  const leafStageIds = leafStages.map(s => s.id);
  console.log(`[COST DEBUG] Leaf stage IDs: [${leafStageIds.join(', ')}]`);

  // Get vendor orders for all leaf stages (actual vendor assignments)
  const { data: vendorPricing, error: pricingError } = await supabase
    .from("vendor_orders")
    .select("stage_id, unit_price, currency")
    .in("stage_id", leafStageIds)
    .eq("sku", selectedSKU)
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress", "completed"]);

  console.log(`[COST DEBUG] Vendor pricing data:`, vendorPricing || []);
  console.log(`[COST DEBUG] Vendor pricing count: ${vendorPricing?.length || 0}`);

  if (pricingError) {
    console.error("Error fetching vendor pricing:", pricingError);
    throw new Error(pricingError.message);
  }

  // Get working quantity for display and total quantity for cost calculation
  // DEFENSIVE FIX: Exclude both scrapped AND replacement items to prevent double-counting
  const { data: orderItems, error: itemsError } = await supabase
    .from("items")
    .select("total_quantity, working_quantity, is_replacement")
    .eq("order_id", selectedOrderId)
    .eq("sku", selectedSKU)
    .eq("organization_id", organizationId)
    .neq("is_scrapped", true) // Exclude scrapped items
    .neq("is_replacement", true); // Exclude replacement items from quantity calculation

  console.log(`[COST DEBUG] Order items data:`, orderItems || []);
  
  if (itemsError) {
    console.error("Error fetching order items:", itemsError);
    throw new Error(itemsError.message);
  }

  // Calculate quantities: working_quantity for display, total_quantity for cost calculation
  const workingQuantity = orderItems?.reduce((sum, item) => sum + (item.working_quantity || 0), 0) || 0;
  const totalQuantityForCost = orderItems?.reduce((sum, item) => sum + item.total_quantity, 0) || 0;
  
  console.log(`[COST DEBUG] Working quantity calculation: ${orderItems?.map(item => item.working_quantity).join(' + ') || '0'} = ${workingQuantity}`);
  console.log(`[COST DEBUG] Total quantity for cost: ${orderItems?.map(item => item.total_quantity).join(' + ') || '0'} = ${totalQuantityForCost}`);

  if (!vendorPricing || vendorPricing.length === 0) {
    return {
      totalCost: 0,
      totalQuantity: workingQuantity, // Show working quantity in UI
      currency: "INR",
      hasMultipleCurrencies: false,
      leafStagesWithPricing: 0,
    };
  }

  // Group pricing by stage and use the lowest cost per stage (conservative approach)
  const stageMinPricing = new Map<string, { price: number; currency: string }>();
  const currencies = new Set<string>();

  console.log(`[COST DEBUG] Processing vendor pricing to find minimum per stage:`);
  
  vendorPricing.forEach(pricing => {
    const stageId = pricing.stage_id;
    const currentMinPrice = stageMinPricing.get(stageId);
    
    currencies.add(pricing.currency);
    
    if (!currentMinPrice || pricing.unit_price < currentMinPrice.price) {
      console.log(`[COST DEBUG]   Stage ${stageId}: Setting min price to ₹${pricing.unit_price} (${pricing.currency})`);
      stageMinPricing.set(stageId, {
        price: pricing.unit_price,
        currency: pricing.currency
      });
    } else {
      console.log(`[COST DEBUG]   Stage ${stageId}: Keeping current min ₹${currentMinPrice.price}, rejecting ₹${pricing.unit_price}`);
    }
  });

  // Calculate total cost: quantity * sum of all leaf stage minimum prices
  const stageBreakdown = Array.from(stageMinPricing.entries()).map(([stageId, pricing]) => {
    const stageName = leafStages.find(s => s.id === stageId)?.name || stageId;
    return {
      stageId,
      stageName,
      price: pricing.price,
      currency: pricing.currency
    };
  });

  console.log(`[COST DEBUG] Stage pricing breakdown:`);
  stageBreakdown.forEach(stage => {
    console.log(`[COST DEBUG]   ${stage.stageName}: ₹${stage.price} per item`);
  });

  const totalPricePerItem = Array.from(stageMinPricing.values())
    .reduce((sum, pricing) => sum + pricing.price, 0);
  
  console.log(`[COST DEBUG] Price per item calculation: ${stageBreakdown.map(s => `₹${s.price}`).join(' + ')} = ₹${totalPricePerItem}`);
  
  const totalCost = totalQuantityForCost * totalPricePerItem;
  
  console.log(`[COST DEBUG] Final calculation: ${totalQuantityForCost} items × ₹${totalPricePerItem} = ₹${totalCost} (cost uses total_quantity)`);
  
  // Use most common currency, or "Mixed" if multiple
  const currency = currencies.size === 1 
    ? Array.from(currencies)[0] 
    : "Mixed";

  return {
    totalCost,
    totalQuantity: workingQuantity, // Show working quantity in UI
    currency,
    hasMultipleCurrencies: currencies.size > 1,
    leafStagesWithPricing: stageMinPricing.size,
  };
}

export function useSidebarSkuCost(
  organizationId: string | null | undefined,
  selectedSKU: string | null,
  selectedOrderId: string | null
) {
  return useQuery<SidebarSkuCost, Error>({
    queryKey: ["sidebar-sku-cost", organizationId, selectedSKU, selectedOrderId],
    queryFn: () => {
      if (!organizationId || !selectedSKU || !selectedOrderId) {
        return Promise.resolve({
          totalCost: 0,
          totalQuantity: 0,
          currency: "INR",
          hasMultipleCurrencies: false,
          leafStagesWithPricing: 0,
        });
      }
      return fetchSidebarSkuCost(organizationId, selectedSKU, selectedOrderId);
    },
    enabled: !!organizationId && !!selectedSKU && !!selectedOrderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}