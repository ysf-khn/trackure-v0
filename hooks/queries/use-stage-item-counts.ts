"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { FetchedWorkflowStage } from "./use-workflow-structure";

interface StageItemCount {
  stageId: string;
  itemCount: number;
  totalQuantity: number;
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
    queryKey: ["stage-item-counts", organizationId, selectedSKU],
    queryFn: async (): Promise<StageItemCountsResult> => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const supabase = createClient();

      // Query to get item counts per stage for the selected SKU
      let query = supabase
        .from("item_stage_allocations")
        .select(`
          stage_id,
          quantity,
          items!inner(sku)
        `)
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

      console.log("[useStageItemCounts] Raw data:", data?.length, "allocations");

      if (!data) {
        return { stageCounts: [], stageCountsMap: new Map() };
      }

      // Aggregate counts by stage_id
      const stageCountsMap = new Map<string, StageItemCount>();

      data.forEach((allocation: any) => {
        const stageId = allocation.stage_id;
        const quantity = allocation.quantity || 0;

        console.log("[useStageItemCounts] Processing allocation:", { stageId, quantity });

        if (stageCountsMap.has(stageId)) {
          const existing = stageCountsMap.get(stageId)!;
          existing.itemCount += 1;
          existing.totalQuantity += quantity;
        } else {
          stageCountsMap.set(stageId, {
            stageId,
            itemCount: 1,
            totalQuantity: quantity,
          });
        }
      });

      const stageCounts = Array.from(stageCountsMap.values());
      console.log("[useStageItemCounts] Final stage counts:", stageCounts);

      return { stageCounts, stageCountsMap };
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute for real-time updates
  });
}

// Helper function to calculate total counts for a stage including all its nested stages
export function calculateTotalStageCount(
  stageId: string,
  workflowData: FetchedWorkflowStage[] | undefined,
  stageCountsMap: Map<string, StageItemCount>
): number {
  if (!workflowData) {
    console.log("[calculateTotalStageCount] No workflow data for stage:", stageId);
    return 0;
  }

  const findStageInTree = (stages: FetchedWorkflowStage[], targetId: string): FetchedWorkflowStage | null => {
    for (const stage of stages) {
      if (stage.id === targetId) {
        return stage;
      }
      if (stage.sub_stages && stage.sub_stages.length > 0) {
        const found = findStageInTree(stage.sub_stages, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const collectAllSubStageIds = (stage: FetchedWorkflowStage): string[] => {
    const ids = [stage.id];
    if (stage.sub_stages && stage.sub_stages.length > 0) {
      stage.sub_stages.forEach(subStage => {
        ids.push(...collectAllSubStageIds(subStage));
      });
    }
    return ids;
  };

  const stage = findStageInTree(workflowData, stageId);
  if (!stage) {
    console.log("[calculateTotalStageCount] Stage not found in tree:", stageId);
    return 0;
  }

  // If this is a leaf stage (no sub-stages), return its direct count
  if (!stage.sub_stages || stage.sub_stages.length === 0) {
    const count = stageCountsMap.get(stageId)?.totalQuantity || 0;
    console.log("[calculateTotalStageCount] Leaf stage", stage.name, "count:", count);
    return count;
  }

  // If this is a parent stage, sum up all sub-stage counts
  const allSubStageIds = collectAllSubStageIds(stage);
  let totalCount = 0;

  console.log("[calculateTotalStageCount] Parent stage", stage.name, "sub-stage IDs:", allSubStageIds);

  allSubStageIds.forEach(id => {
    const stageCount = stageCountsMap.get(id);
    if (stageCount) {
      console.log("[calculateTotalStageCount] Adding count for", id, ":", stageCount.totalQuantity);
      totalCount += stageCount.totalQuantity;
    }
  });

  console.log("[calculateTotalStageCount] Total count for", stage.name, ":", totalCount);
  return totalCount;
}