"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useWorkflowStructure, type FetchedWorkflowStage } from "./use-workflow-structure";
import { ItemInStage } from "./use-items-in-stage";

// Multi-stage data structure
export interface StageWithItems {
  stage: FetchedWorkflowStage;
  items: ItemInStage[];
  itemCount: number;
  totalQuantity: number;
}

export interface MultiStageData {
  currentStage: StageWithItems;
  previousStages: StageWithItems[];
  nextStages: StageWithItems[];
  allStages: StageWithItems[];
}

// Utility to flatten workflow tree and get sequential order
function flattenWorkflowTree(stages: FetchedWorkflowStage[]): FetchedWorkflowStage[] {
  const allStages: FetchedWorkflowStage[] = [];
  
  function flatten(stageList: FetchedWorkflowStage[]) {
    stageList.forEach(stage => {
      allStages.push(stage);
      if (stage.children && stage.children.length > 0) {
        flatten(stage.children);
      }
    });
  }
  
  flatten(stages);
  
  // Sort by sequence path for proper ordering
  return allStages.sort((a, b) => {
    const aPath = a.full_path?.split('.').map(Number) || [a.sequence_order];
    const bPath = b.full_path?.split('.').map(Number) || [b.sequence_order];
    
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      const aVal = aPath[i] || 0;
      const bVal = bPath[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
}

// Fetch items for a specific stage
async function fetchStageItems(
  organizationId: string,
  stageId: string,
  sku: string | null
): Promise<ItemInStage[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase.rpc('get_items_in_stage', {
    stage_id_param: stageId,
    organization_id_param: organizationId,
    sku_filter: sku
  });

  if (error) {
    console.error(`Error fetching items for stage ${stageId}:`, error);
    return [];
  }

  return data || [];
}

// Main hook
export const useMultiStageItems = (
  organizationId: string | undefined | null,
  currentStageId: string | undefined,
  sku: string | null,
  contextStageCount: number = 2 // How many stages before/after to include
) => {
  // Get workflow structure
  const { data: workflowData, isLoading: isLoadingWorkflow } = useWorkflowStructure(
    organizationId,
    sku
  );

  return useQuery<MultiStageData, Error>({
    queryKey: [
      'multi-stage-items',
      organizationId,
      currentStageId,
      sku,
      contextStageCount,
      workflowData?.length || 0
    ],
    queryFn: async (): Promise<MultiStageData> => {
      if (!organizationId || !currentStageId || !workflowData) {
        throw new Error('Missing required parameters');
      }

      // Flatten and sort all stages
      const allStages = flattenWorkflowTree(workflowData);
      
      // Find current stage index
      const currentIndex = allStages.findIndex(stage => stage.id === currentStageId);
      if (currentIndex === -1) {
        throw new Error('Current stage not found in workflow');
      }

      // Determine which stages to fetch
      const startIndex = Math.max(0, currentIndex - contextStageCount);
      const endIndex = Math.min(allStages.length - 1, currentIndex + contextStageCount);
      const stagesToFetch = allStages.slice(startIndex, endIndex + 1);

      // Fetch items for all relevant stages in parallel
      const stageDataPromises = stagesToFetch.map(async (stage): Promise<StageWithItems> => {
        const items = await fetchStageItems(organizationId, stage.id, sku);
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        
        return {
          stage,
          items,
          itemCount: items.length,
          totalQuantity
        };
      });

      const stageDataList = await Promise.all(stageDataPromises);

      // Categorize stages
      const currentStageData = stageDataList.find(sd => sd.stage.id === currentStageId);
      if (!currentStageData) {
        throw new Error('Current stage data not found');
      }

      const previousStages = stageDataList.filter((sd, index) => 
        stagesToFetch.findIndex(s => s.id === sd.stage.id) < currentIndex - startIndex
      );

      const nextStages = stageDataList.filter((sd, index) => 
        stagesToFetch.findIndex(s => s.id === sd.stage.id) > currentIndex - startIndex
      );

      return {
        currentStage: currentStageData,
        previousStages,
        nextStages,
        allStages: stageDataList
      };
    },
    enabled: !!organizationId && !!currentStageId && !!workflowData && !isLoadingWorkflow,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
};