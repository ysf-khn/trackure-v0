"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { FetchedWorkflowStage } from "./use-workflow-structure";

export interface StageCostSummary {
  stageId: string;
  stageName: string;
  itemCount: number;
  totalQuantity: number;
  vendorCount: number;
  lowestCost: number;
  highestCost: number;
  averageCost: number;
  currency: string;
  estimatedTotalCost: number;
}

export interface WorkflowCostSummary {
  totalItems: number;
  totalQuantity: number;
  totalStagesWithPricing: number;
  totalVendors: number;
  estimatedTotalCost: number;
  currency: string;
  stageBreakdown: StageCostSummary[];
  hasMultipleCurrencies: boolean;
}

async function fetchWorkflowCostSummary(
  organizationId: string,
  selectedSKU: string,
  workflowStages: FetchedWorkflowStage[]
): Promise<WorkflowCostSummary> {
  console.log("[fetchWorkflowCostSummary] Function started with params:", {
    organizationId,
    selectedSKU,
    workflowStagesCount: workflowStages.length
  });

  const supabase = createClient();

  // Get all stage IDs that could have vendor pricing
  // Previously only looked at leaf stages, but vendors can price any stage
  const collectAllStageIds = (stages: FetchedWorkflowStage[]): string[] => {
    const ids: string[] = [];
    stages.forEach((stage) => {
      ids.push(stage.id);
      if (stage.children && stage.children.length > 0) {
        ids.push(...collectAllStageIds(stage.children));
      }
    });
    return ids;
  };

  const allStageIds = collectAllStageIds(workflowStages);

  console.log("[fetchWorkflowCostSummary] All stages found:", {
    allStages: workflowStages.map(s => ({ id: s.id, name: s.name, is_leaf_stage: s.is_leaf_stage })),
    allStageIds,
    stageCount: allStageIds.length
  });

  if (allStageIds.length === 0) {
    console.log("[fetchWorkflowCostSummary] No stages found, returning default data");
    return {
      totalItems: 0,
      totalQuantity: 0,
      totalStagesWithPricing: 0,
      totalVendors: 0,
      estimatedTotalCost: 0,
      currency: "INR",
      stageBreakdown: [],
      hasMultipleCurrencies: false,
    };
  }

  // Debug logging
  console.log("[useWorkflowCostSummary] Debug info:", {
    organizationId,
    selectedSKU,
    allStageIds,
    stageCount: allStageIds.length
  });

  // First try a simpler query without the vendor join to see what data exists
  const { data: allPricingData, error: allPricingError } = await supabase
    .from("vendor_stage_pricing")
    .select("id, stage_id, price, currency, is_active, sku, organization_id")
    .eq("organization_id", organizationId);

  console.log("[useWorkflowCostSummary] All pricing data for org:", {
    data: allPricingData,
    count: allPricingData?.length || 0
  });

  // Fetch vendor pricing for all leaf stages
  const { data: vendorPricingData, error: pricingError } = await supabase
    .from("vendor_stage_pricing")
    .select(`
      id,
      stage_id,
      price,
      currency,
      is_active,
      vendors!inner(name)
    `)
    .in("stage_id", allStageIds)
    .eq("sku", selectedSKU)
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  console.log("[useWorkflowCostSummary] Vendor pricing query result:", {
    data: vendorPricingData,
    error: pricingError,
    dataLength: vendorPricingData?.length || 0
  });

  if (pricingError) {
    console.error("Error fetching vendor pricing:", pricingError);
    throw new Error(pricingError.message);
  }

  // Fetch item counts for all leaf stages
  const { data: itemCountsData, error: countsError } = await supabase
    .from("item_stage_allocations")
    .select(`
      stage_id,
      quantity,
      items!inner(sku)
    `)
    .in("stage_id", allStageIds)
    .eq("items.sku", selectedSKU)
    .eq("items.organization_id", organizationId)
    .eq("status", "active");

  if (countsError) {
    console.error("Error fetching item counts:", countsError);
    throw new Error(countsError.message);
  }

  // Group pricing by stage
  const pricingByStage = new Map<string, any[]>();
  vendorPricingData?.forEach(pricing => {
    const stageId = pricing.stage_id;
    if (!pricingByStage.has(stageId)) {
      pricingByStage.set(stageId, []);
    }
    pricingByStage.get(stageId)!.push(pricing);
  });

  // Group item counts by stage
  const countsByStage = new Map<string, { itemCount: number; totalQuantity: number }>();
  itemCountsData?.forEach(allocation => {
    const stageId = allocation.stage_id;
    const quantity = allocation.quantity || 0;
    
    if (!countsByStage.has(stageId)) {
      countsByStage.set(stageId, { itemCount: 0, totalQuantity: 0 });
    }
    
    const current = countsByStage.get(stageId)!;
    current.itemCount += 1;
    current.totalQuantity += quantity;
  });

  // Calculate stage-level summaries
  const stageBreakdown: StageCostSummary[] = [];
  const currencies = new Set<string>();
  let totalEstimatedCost = 0;
  let totalItems = 0;
  let totalQuantity = 0;
  let totalStagesWithPricing = 0;
  let totalVendors = 0;

  allStageIds.forEach(stageId => {
    // Find stage in the nested structure
    const findStageInTree = (stages: FetchedWorkflowStage[], targetId: string): FetchedWorkflowStage | null => {
      for (const stage of stages) {
        if (stage.id === targetId) {
          return stage;
        }
        if (stage.children && stage.children.length > 0) {
          const found = findStageInTree(stage.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };
    
    const stage = findStageInTree(workflowStages, stageId);
    const pricing = pricingByStage.get(stageId) || [];
    const counts = countsByStage.get(stageId) || { itemCount: 0, totalQuantity: 0 };

    if (pricing.length > 0) {
      const prices = pricing.map(p => p.price);
      const lowestCost = Math.min(...prices);
      const highestCost = Math.max(...prices);
      const averageCost = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const currency = pricing[0].currency;
      
      currencies.add(currency);
      totalStagesWithPricing += 1;
      totalVendors += pricing.length;

      // Use lowest cost for estimation (conservative approach)
      const estimatedStageCost = counts.totalQuantity * lowestCost;
      totalEstimatedCost += estimatedStageCost;

      stageBreakdown.push({
        stageId,
        stageName: stage?.name || "Unnamed Stage",
        itemCount: counts.itemCount,
        totalQuantity: counts.totalQuantity,
        vendorCount: pricing.length,
        lowestCost,
        highestCost,
        averageCost,
        currency,
        estimatedTotalCost: estimatedStageCost,
      });
    }

    totalItems += counts.itemCount;
    totalQuantity += counts.totalQuantity;
  });

  // Sort stage breakdown by highest cost first
  stageBreakdown.sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost);

  return {
    totalItems,
    totalQuantity,
    totalStagesWithPricing,
    totalVendors,
    estimatedTotalCost: totalEstimatedCost,
    currency: currencies.size === 1 ? Array.from(currencies)[0] : "Mixed",
    stageBreakdown,
    hasMultipleCurrencies: currencies.size > 1,
  };
}

export function useWorkflowCostSummary(
  organizationId: string | null | undefined,
  selectedSKU: string | null,
  workflowStages: FetchedWorkflowStage[] | undefined
) {
  console.log("[useWorkflowCostSummary] Hook called with:", {
    organizationId: !!organizationId,
    selectedSKU: !!selectedSKU,
    workflowStages: !!workflowStages,
    workflowStagesLength: workflowStages?.length,
    enabled: !!organizationId && !!selectedSKU && !!workflowStages
  });

  return useQuery<WorkflowCostSummary, Error>({
    queryKey: ["workflow-cost-summary", organizationId, selectedSKU],
    queryFn: () => {
      console.log("[useWorkflowCostSummary] QueryFn executing...");
      if (!organizationId || !selectedSKU || !workflowStages) {
        console.log("[useWorkflowCostSummary] Returning default data due to missing params");
        return Promise.resolve({
          totalItems: 0,
          totalQuantity: 0,
          totalStagesWithPricing: 0,
          totalVendors: 0,
          estimatedTotalCost: 0,
          currency: "INR",
          stageBreakdown: [],
          hasMultipleCurrencies: false,
        });
      }
      console.log("[useWorkflowCostSummary] Calling fetchWorkflowCostSummary...");
      return fetchWorkflowCostSummary(organizationId, selectedSKU, workflowStages);
    },
    enabled: !!organizationId && !!selectedSKU && !!workflowStages,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}