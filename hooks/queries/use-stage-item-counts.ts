"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { FetchedWorkflowStage } from "./use-workflow-structure";
import { queryKeys } from "@/lib/query-keys";

interface StageItemCount {
  stageId: string;
  itemCount: number;
  totalQuantity: number;
  normalQuantity: number;
  reworkedQuantity: number;
}

interface StageItemCountsResult {
  stageCounts: StageItemCount[];
  stageCountsMap: Map<string, StageItemCount>;
}

export function useStageItemCounts(
  organizationId: string | null | undefined,
  selectedSKU: string | null,
  workflowData: FetchedWorkflowStage[] | undefined
) {
  return useQuery({
    queryKey: queryKeys.stageItemCounts(organizationId, selectedSKU),
    queryFn: async (): Promise<StageItemCountsResult> => {
      console.log(
        "[STAGE COUNTS DEBUG] Fetching stage counts for org:",
        organizationId,
        "sku:",
        selectedSKU
      );
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const supabase = createClient();

      // Query to get item counts per stage for the selected SKU
      // Include allocation_type to separate normal vs reworked counts
      let query = supabase
        .from("item_stage_allocations")
        .select(
          `
          stage_id,
          quantity,
          allocation_type,
          items!inner(sku)
        `
        )
        .eq("organization_id", organizationId);

      // Filter by SKU if selected
      if (selectedSKU) {
        query = query.eq("items.sku", selectedSKU);
      } else {
        // If no SKU selected, get items with null SKU (organization default workflow)
        query = query.is("items.sku", null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching stage item counts:", error);
        throw new Error(`Failed to fetch stage item counts: ${error.message}`);
      }

      console.log(
        "[useStageItemCounts] Raw data:",
        data?.length,
        "allocations"
      );

      if (!data) {
        return { stageCounts: [], stageCountsMap: new Map() };
      }

      // Aggregate counts by stage_id
      const stageCountsMap = new Map<string, StageItemCount>();

      data.forEach((allocation: any) => {
        const stageId = allocation.stage_id;
        const quantity = allocation.quantity || 0;
        // Default to 'normal' if allocation_type doesn't exist (backward compatibility)
        const allocationType = allocation.allocation_type || "normal";

        console.log("[useStageItemCounts] Processing allocation:", {
          stageId,
          quantity,
          allocationType,
        });

        if (stageCountsMap.has(stageId)) {
          const existing = stageCountsMap.get(stageId)!;
          existing.itemCount += 1;
          existing.totalQuantity += quantity;

          if (allocationType === "reworked") {
            existing.reworkedQuantity += quantity;
          } else {
            existing.normalQuantity += quantity;
          }
        } else {
          stageCountsMap.set(stageId, {
            stageId,
            itemCount: 1,
            totalQuantity: quantity,
            normalQuantity: allocationType === "normal" ? quantity : 0,
            reworkedQuantity: allocationType === "reworked" ? quantity : 0,
          });
        }
      });

      const stageCounts = Array.from(stageCountsMap.values());
      console.log("[useStageItemCounts] Final stage counts:", stageCounts);
      console.log(
        "[STAGE COUNTS DEBUG] Query execution completed at:",
        new Date().toISOString()
      );

      return { stageCounts, stageCountsMap };
    },
    enabled: !!organizationId,
    // Use global defaults from QueryClient for better consistency
    // Override only when necessary for this specific query
    staleTime: 0, // Always consider this data stale for immediate updates
    meta: {
      // Add metadata for debugging
      queryType: "stage-item-counts",
    },
  });
}

// Helper function to calculate total counts for a stage including all its nested stages
export function calculateTotalStageCount(
  stageId: string,
  workflowData: FetchedWorkflowStage[] | undefined,
  stageCountsMap: Map<string, StageItemCount>
): number {
  const result = calculateDetailedStageCount(
    stageId,
    workflowData,
    stageCountsMap
  );
  return result.totalQuantity;
}

// Helper function to calculate detailed counts (normal + reworked) for a stage including all its nested stages
export function calculateDetailedStageCount(
  stageId: string,
  workflowData: FetchedWorkflowStage[] | undefined,
  stageCountsMap: Map<string, StageItemCount>
): { totalQuantity: number; normalQuantity: number; reworkedQuantity: number } {
  if (!workflowData) {
    console.log(
      "[calculateTotalStageCount] No workflow data for stage:",
      stageId
    );
    return { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
  }

  const findStageInTree = (
    stages: FetchedWorkflowStage[],
    targetId: string
  ): FetchedWorkflowStage | null => {
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

  const collectAllChildStageIds = (stage: FetchedWorkflowStage): string[] => {
    const ids = [stage.id];
    if (stage.children && stage.children.length > 0) {
      stage.children.forEach((childStage) => {
        ids.push(...collectAllChildStageIds(childStage));
      });
    }
    return ids;
  };

  const stage = findStageInTree(workflowData, stageId);
  if (!stage) {
    console.log("[calculateTotalStageCount] Stage not found in tree:", stageId);
    return { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
  }

  // If this is a leaf stage (no children), return its direct count
  if (!stage.children || stage.children.length === 0) {
    const stageCount = stageCountsMap.get(stageId);
    const result = {
      totalQuantity: stageCount?.totalQuantity || 0,
      normalQuantity: stageCount?.normalQuantity || 0,
      reworkedQuantity: stageCount?.reworkedQuantity || 0,
    };
    console.log(
      "[calculateDetailedStageCount] Leaf stage",
      stage.name,
      "count:",
      result
    );
    return result;
  }

  // If this is a parent stage, sum up all child stage counts
  const allChildStageIds = collectAllChildStageIds(stage);
  let totalCount = 0;
  let normalCount = 0;
  let reworkedCount = 0;

  console.log(
    "[calculateDetailedStageCount] Parent stage",
    stage.name,
    "child stage IDs:",
    allChildStageIds
  );

  allChildStageIds.forEach((id) => {
    const stageCount = stageCountsMap.get(id);
    if (stageCount) {
      console.log(
        "[calculateDetailedStageCount] Adding count for",
        id,
        ":",
        stageCount
      );
      totalCount += stageCount.totalQuantity;
      normalCount += stageCount.normalQuantity;
      reworkedCount += stageCount.reworkedQuantity;
    }
  });

  const result = {
    totalQuantity: totalCount,
    normalQuantity: normalCount,
    reworkedQuantity: reworkedCount,
  };
  console.log(
    "[calculateDetailedStageCount] Total count for",
    stage.name,
    ":",
    result
  );
  return result;
}

// Helper function to calculate total workflow items summary
export function calculateWorkflowItemsSummary(
  workflowData: FetchedWorkflowStage[] | undefined,
  stageCountsMap: Map<string, StageItemCount>
): {
  totalItems: number;
  totalQuantity: number;
  normalQuantity: number;
  reworkedQuantity: number;
  stagesWithItems: number;
  totalStages: number;
} {
  if (!workflowData || !stageCountsMap) {
    return {
      totalItems: 0,
      totalQuantity: 0,
      normalQuantity: 0,
      reworkedQuantity: 0,
      stagesWithItems: 0,
      totalStages: 0,
    };
  }

  // Collect all stage IDs from the workflow tree
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

  const allStageIds = collectAllStageIds(workflowData);
  
  let totalItems = 0;
  let totalQuantity = 0;
  let normalQuantity = 0;
  let reworkedQuantity = 0;
  let stagesWithItems = 0;

  allStageIds.forEach((stageId) => {
    const stageCount = stageCountsMap.get(stageId);
    if (stageCount) {
      totalItems += stageCount.itemCount;
      totalQuantity += stageCount.totalQuantity;
      normalQuantity += stageCount.normalQuantity;
      reworkedQuantity += stageCount.reworkedQuantity;
      
      if (stageCount.totalQuantity > 0) {
        stagesWithItems += 1;
      }
    }
  });

  return {
    totalItems,
    totalQuantity,
    normalQuantity,
    reworkedQuantity,
    stagesWithItems,
    totalStages: allStageIds.length,
  };
}
