// Type definition for the expected structure of workflow stages fetched from DB
// Updated to use the new tree structure
export type WorkflowStage = {
  id: string;
  sequence_order: number;
  parent_stage_id: string | null;
  depth_level: number;
  sub_stages: {
    id: string;
    sequence_order: number;
  }[];
};

// Import the new tree structure type
import { type FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

// Helper function to convert tree structure to flat array for legacy functions
export function convertTreeToFlat(treeStages: FetchedWorkflowStage[]): WorkflowStage[] {
  const flatStages: WorkflowStage[] = [];
  
  function processStage(stage: FetchedWorkflowStage) {
    // Add the stage with its immediate children
    flatStages.push({
      id: stage.id,
      sequence_order: stage.sequence_order,
      parent_stage_id: stage.parent_stage_id,
      depth_level: stage.depth_level,
      sub_stages: stage.sub_stages.map(sub => ({
        id: sub.id,
        sequence_order: sub.sequence_order
      }))
    });
    
    // Recursively process sub-stages as main stages
    stage.sub_stages.forEach(processStage);
  }
  
  treeStages.forEach(processStage);
  return flatStages;
}

/**
 * Determines the next stage in the workflow sequence.
 * Updated to work with tree structure - in tree structure, sub_stage_id is not used.
 * @param currentStageId The ID of the item's current stage.
 * @param currentSubStageId The ID of the item's current sub-stage (null if none) - DEPRECATED in tree structure.
 * @param workflowStages The workflow stages (can be tree structure or flat).
 * @returns An object containing the next { stageId, subStageId } or null if at the end of the workflow.
 */
export function determineNextStage(
  currentStageId: string,
  currentSubStageId: string | null,
  workflowStages: WorkflowStage[] | FetchedWorkflowStage[]
): { stageId: string; subStageId: string | null } | null {
  // Check if we're working with tree structure
  const isTreeStructure = workflowStages.length > 0 && 'parent_stage_id' in workflowStages[0];
  
  console.log(`[determineNextStage] Current stage: ${currentStageId}, isTreeStructure: ${isTreeStructure}, total stages: ${workflowStages.length}`);
  
  if (isTreeStructure) {
    // Tree structure logic
    const treeStages = workflowStages as FetchedWorkflowStage[];
    const result = determineNextStageTree(currentStageId, treeStages);
    console.log(`[determineNextStage] Tree result:`, result);
    return result;
  } else {
    // Legacy flat structure logic
    const flatStages = workflowStages as WorkflowStage[];
    const result = determineNextStageFlat(currentStageId, currentSubStageId, flatStages);
    console.log(`[determineNextStage] Flat result:`, result);
    return result;
  }
}

/**
 * Determines next stage for tree structure
 */
function determineNextStageTree(
  currentStageId: string,
  workflowStages: FetchedWorkflowStage[]
): { stageId: string; subStageId: string | null } | null {
  // Flatten the tree to get a sequence-ordered list of all stages
  const allStages: { id: string; sequence_order: number; full_path: string | null }[] = [];
  
  function flattenTree(stages: FetchedWorkflowStage[], parentPath = "") {
    stages.forEach(stage => {
      const currentPath = parentPath ? `${parentPath}.${stage.sequence_order}` : stage.sequence_order.toString();
      allStages.push({
        id: stage.id,
        sequence_order: stage.sequence_order,
        full_path: currentPath
      });
      
      if (stage.sub_stages && stage.sub_stages.length > 0) {
        flattenTree(stage.sub_stages, currentPath);
      }
    });
  }
  
  flattenTree(workflowStages);
  
  console.log(`[determineNextStageTree] Flattened ${allStages.length} stages:`, allStages.map(s => ({ id: s.id, path: s.full_path })));
  
  // Sort by full path to get the correct sequence
  allStages.sort((a, b) => {
    const aPath = a.full_path?.split('.').map(Number) || [a.sequence_order];
    const bPath = b.full_path?.split('.').map(Number) || [b.sequence_order];
    
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      const aVal = aPath[i] || 0;
      const bVal = bPath[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
  
  console.log(`[determineNextStageTree] Sorted stages:`, allStages.map(s => ({ id: s.id, path: s.full_path })));
  
  // Find current stage and return next
  const currentIndex = allStages.findIndex(stage => stage.id === currentStageId);
  console.log(`[determineNextStageTree] Current stage ${currentStageId} found at index: ${currentIndex}`);
  
  if (currentIndex === -1 || currentIndex === allStages.length - 1) {
    console.log(`[determineNextStageTree] No next stage found (current index: ${currentIndex}, total: ${allStages.length})`);
    return null;
  }
  
  const nextStage = allStages[currentIndex + 1];
  console.log(`[determineNextStageTree] Next stage found:`, nextStage);
  return { stageId: nextStage.id, subStageId: null };
}

/**
 * Legacy flat structure logic
 */
function determineNextStageFlat(
  currentStageId: string,
  currentSubStageId: string | null,
  workflowStages: WorkflowStage[]
): { stageId: string; subStageId: string | null } | null {
  const currentStageIndex = workflowStages.findIndex(
    (s) => s.id === currentStageId
  );

  if (currentStageIndex === -1) {
    console.error(
      `determineNextStage: Current stage ID ${currentStageId} not found in workflow.`
    );
    return null;
  }

  const currentStage = workflowStages[currentStageIndex];

  // Case 1: Currently in a sub-stage
  if (currentSubStageId) {
    const currentSubStages = currentStage.sub_stages ?? [];
    const currentSubStageIndex = currentSubStages.findIndex(
      (ss) => ss.id === currentSubStageId
    );

    if (currentSubStageIndex === -1) {
      console.error(
        `determineNextStage: Current sub-stage ID ${currentSubStageId} not found in stage ${currentStageId}.`
      );
      return null;
    }

    // Case 1a: There is a next sub-stage within the current stage
    if (currentSubStageIndex < currentSubStages.length - 1) {
      const nextSubStage = currentSubStages[currentSubStageIndex + 1];
      return { stageId: currentStageId, subStageId: nextSubStage.id };
    }
  }

  // Case 2: Find the next main stage
  if (currentStageIndex < workflowStages.length - 1) {
    const nextStage = workflowStages[currentStageIndex + 1];
    const nextSubStages = nextStage.sub_stages ?? [];

    if (nextSubStages.length > 0) {
      return { stageId: nextStage.id, subStageId: nextSubStages[0].id };
    } else {
      return { stageId: nextStage.id, subStageId: null };
    }
  }

  return null;
}

/**
 * Determines the previous stage and/or sub-stage in the workflow sequence.
 * Used for actions like "Send Back" or "Rework".
 * Updated to work with tree structure - in tree structure, sub_stage_id is not used.
 * @param currentStageId The ID of the item's current stage.
 * @param currentSubStageId The ID of the item's current sub-stage (null if none) - DEPRECATED in tree structure.
 * @param workflowStages The workflow stages (can be tree structure or flat).
 * @returns An object containing the previous { stageId, subStageId } or null if at the start of the workflow.
 */
export function determinePreviousStage(
  currentStageId: string,
  currentSubStageId: string | null,
  workflowStages: WorkflowStage[] | FetchedWorkflowStage[]
): { stageId: string; subStageId: string | null } | null {
  // Check if we're working with tree structure
  const isTreeStructure = workflowStages.length > 0 && 'parent_stage_id' in workflowStages[0];
  
  console.log(`[determinePreviousStage] Current stage: ${currentStageId}, isTreeStructure: ${isTreeStructure}, total stages: ${workflowStages.length}`);
  
  if (isTreeStructure) {
    // Tree structure logic
    const treeStages = workflowStages as FetchedWorkflowStage[];
    const result = determinePreviousStageTree(currentStageId, treeStages);
    console.log(`[determinePreviousStage] Tree result:`, result);
    return result;
  } else {
    // Legacy flat structure logic
    const flatStages = workflowStages as WorkflowStage[];
    const result = determinePreviousStageFlat(currentStageId, currentSubStageId, flatStages);
    console.log(`[determinePreviousStage] Flat result:`, result);
    return result;
  }
}

/**
 * Determines previous stage for tree structure
 */
function determinePreviousStageTree(
  currentStageId: string,
  workflowStages: FetchedWorkflowStage[]
): { stageId: string; subStageId: string | null } | null {
  // Flatten the tree to get a sequence-ordered list of all stages
  const allStages: { id: string; sequence_order: number; full_path: string | null }[] = [];
  
  function flattenTree(stages: FetchedWorkflowStage[], parentPath = "") {
    stages.forEach(stage => {
      const currentPath = parentPath ? `${parentPath}.${stage.sequence_order}` : stage.sequence_order.toString();
      allStages.push({
        id: stage.id,
        sequence_order: stage.sequence_order,
        full_path: currentPath
      });
      
      if (stage.sub_stages && stage.sub_stages.length > 0) {
        flattenTree(stage.sub_stages, currentPath);
      }
    });
  }
  
  flattenTree(workflowStages);
  
  console.log(`[determinePreviousStageTree] Flattened ${allStages.length} stages:`, allStages.map(s => ({ id: s.id, path: s.full_path })));
  
  // Sort by full path to get the correct sequence
  allStages.sort((a, b) => {
    const aPath = a.full_path?.split('.').map(Number) || [a.sequence_order];
    const bPath = b.full_path?.split('.').map(Number) || [b.sequence_order];
    
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      const aVal = aPath[i] || 0;
      const bVal = bPath[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
  
  console.log(`[determinePreviousStageTree] Sorted stages:`, allStages.map(s => ({ id: s.id, path: s.full_path })));
  
  // Find current stage and return previous
  const currentIndex = allStages.findIndex(stage => stage.id === currentStageId);
  console.log(`[determinePreviousStageTree] Current stage ${currentStageId} found at index: ${currentIndex}`);
  
  if (currentIndex === -1 || currentIndex === 0) {
    console.log(`[determinePreviousStageTree] No previous stage found (current index: ${currentIndex}, total: ${allStages.length})`);
    return null;
  }
  
  const previousStage = allStages[currentIndex - 1];
  console.log(`[determinePreviousStageTree] Previous stage found:`, previousStage);
  return { stageId: previousStage.id, subStageId: null };
}

/**
 * Legacy flat structure logic
 */
function determinePreviousStageFlat(
  currentStageId: string,
  currentSubStageId: string | null,
  workflowStages: WorkflowStage[]
): { stageId: string; subStageId: string | null } | null {
  const currentStageIndex = workflowStages.findIndex(
    (s) => s.id === currentStageId
  );

  if (currentStageIndex === -1) {
    console.error(
      `determinePreviousStage: Current stage ID ${currentStageId} not found in workflow.`
    );
    return null; // Current stage doesn't exist
  }

  const currentStage = workflowStages[currentStageIndex];

  // Case 1: Currently in a sub-stage
  if (currentSubStageId) {
    const currentSubStages = currentStage.sub_stages ?? [];
    const currentSubStageIndex = currentSubStages.findIndex(
      (ss) => ss.id === currentSubStageId
    );

    if (currentSubStageIndex === -1) {
      console.error(
        `determinePreviousStage: Current sub-stage ID ${currentSubStageId} not found in stage ${currentStageId}.`
      );
      return null; // Data inconsistency
    }

    // Case 1a: There is a previous sub-stage within the current stage
    if (currentSubStageIndex > 0) {
      const previousSubStage = currentSubStages[currentSubStageIndex - 1];
      return { stageId: currentStageId, subStageId: previousSubStage.id };
    }
    // Case 1b: This was the first sub-stage; move to the main stage itself (treated as the step before the first sub-stage)
    else {
      return { stageId: currentStageId, subStageId: null };
    }
  }

  // Case 2: Currently at a main stage (no sub-stage ID provided, or was the first sub-stage)
  // Find the previous main stage in the sequence
  if (currentStageIndex > 0) {
    const previousStage = workflowStages[currentStageIndex - 1];
    const previousSubStages = previousStage.sub_stages ?? [];

    // Case 2a: The previous main stage has sub-stages; move to its *last* sub-stage
    if (previousSubStages.length > 0) {
      return {
        stageId: previousStage.id,
        subStageId: previousSubStages[previousSubStages.length - 1].id,
      };
    }
    // Case 2b: The previous main stage has no sub-stages; move directly to it
    else {
      return { stageId: previousStage.id, subStageId: null };
    }
  }

  // Case 3: Currently at the first main stage (and not in a sub-stage, or was its first sub-stage)
  // This is the beginning of the workflow
  return null;
}

// --- NEW FUNCTION --- //
interface SubsequentStageInfo {
  id: string;
  name: string | null;
  isSubStage?: boolean;
  parentStageId?: string;
  parentStageName?: string | null;
}

interface PreviousStageInfo {
  id: string;
  name: string | null;
  isSubStage?: boolean;
  parentStageId?: string;
  parentStageName?: string | null;
}

export function getSubsequentStages(
  workflowData: FetchedWorkflowStage[],
  currentStageId: string,
  currentSubStageId: string | null | undefined
): SubsequentStageInfo[] {
  const subsequent: SubsequentStageInfo[] = [];
  if (!workflowData || workflowData.length === 0) {
    return [];
  }

  // Flatten the tree to get all stages in sequence order
  const allStages: { stage: FetchedWorkflowStage; path: string; isLeaf: boolean }[] = [];
  
  function flattenTree(stages: FetchedWorkflowStage[], parentPath = "") {
    stages.forEach(stage => {
      const currentPath = parentPath ? `${parentPath}.${stage.sequence_order}` : stage.sequence_order.toString();
      const isLeaf = !stage.sub_stages || stage.sub_stages.length === 0;
      
      // Only add leaf stages as they can receive items
      if (isLeaf) {
        allStages.push({
          stage,
          path: currentPath,
          isLeaf
        });
      }
      
      if (stage.sub_stages && stage.sub_stages.length > 0) {
        flattenTree(stage.sub_stages, currentPath);
      }
    });
  }
  
  flattenTree(workflowData);
  
  // Sort by path to get the correct sequence
  allStages.sort((a, b) => {
    const aPath = a.path.split('.').map(Number);
    const bPath = b.path.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      const aVal = aPath[i] || 0;
      const bVal = bPath[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
  
  // Find current stage index and return all subsequent stages
  const currentIndex = allStages.findIndex(item => item.stage.id === currentStageId);
  if (currentIndex === -1) {
    console.error("getSubsequentStages: Current stage not found");
    return [];
  }
  
  // Add all subsequent stages
  for (let i = currentIndex + 1; i < allStages.length; i++) {
    const item = allStages[i];
    const stage = item.stage;
    
    // Build breadcrumb name from full_path or fallback to stage name
    const breadcrumbName = stage.full_path || stage.name;
    
    subsequent.push({
      id: stage.id,
      name: breadcrumbName,
      isSubStage: stage.depth_level > 0,
      parentStageId: stage.parent_stage_id,
      parentStageName: stage.parent_stage_id ? findParentStageName(workflowData, stage.parent_stage_id) : null,
    });
  }
  
  return subsequent;
}

export function getPreviousStages(
  workflowData: FetchedWorkflowStage[],
  currentStageId: string,
  currentSubStageId: string | null | undefined
): PreviousStageInfo[] {
  console.log(`[getPreviousStages] Called with:`, {
    workflowDataLength: workflowData?.length || 0,
    currentStageId,
    currentSubStageId
  });

  const previous: PreviousStageInfo[] = [];
  if (!workflowData || workflowData.length === 0) {
    console.log(`[getPreviousStages] No workflow data, returning empty array`);
    return [];
  }

  // Flatten the tree to get all stages in sequence order
  const allStages: { stage: FetchedWorkflowStage; path: string; isLeaf: boolean }[] = [];
  
  function flattenTree(stages: FetchedWorkflowStage[], parentPath = "") {
    stages.forEach(stage => {
      const currentPath = parentPath ? `${parentPath}.${stage.sequence_order}` : stage.sequence_order.toString();
      const isLeaf = !stage.sub_stages || stage.sub_stages.length === 0;
      
      // Only add leaf stages as they can receive items
      if (isLeaf) {
        allStages.push({
          stage,
          path: currentPath,
          isLeaf
        });
      }
      
      if (stage.sub_stages && stage.sub_stages.length > 0) {
        flattenTree(stage.sub_stages, currentPath);
      }
    });
  }
  
  flattenTree(workflowData);
  
  console.log(`[getPreviousStages] Flattened ${allStages.length} leaf stages:`, 
    allStages.map(s => ({ id: s.stage.id, name: s.stage.name, path: s.path, isLeaf: s.isLeaf }))
  );
  
  // Sort by path to get the correct sequence
  allStages.sort((a, b) => {
    const aPath = a.path.split('.').map(Number);
    const bPath = b.path.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      const aVal = aPath[i] || 0;
      const bVal = bPath[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
  
  console.log(`[getPreviousStages] Sorted stages:`, 
    allStages.map(s => ({ id: s.stage.id, name: s.stage.name, path: s.path }))
  );
  
  // Find current stage index and return all previous stages
  const currentIndex = allStages.findIndex(item => item.stage.id === currentStageId);
  console.log(`[getPreviousStages] Current stage ${currentStageId} found at index: ${currentIndex}`);
  
  if (currentIndex === -1) {
    console.error("getPreviousStages: Current stage not found in flattened stages");
    return [];
  }
  
  // Add all previous stages
  for (let i = 0; i < currentIndex; i++) {
    const item = allStages[i];
    const stage = item.stage;
    
    // Build breadcrumb name from full_path or fallback to stage name
    const breadcrumbName = stage.full_path || stage.name;
    
    previous.push({
      id: stage.id,
      name: breadcrumbName,
      isSubStage: stage.depth_level > 0,
      parentStageId: stage.parent_stage_id,
      parentStageName: stage.parent_stage_id ? findParentStageName(workflowData, stage.parent_stage_id) : null,
    });
  }
  
  console.log(`[getPreviousStages] Returning ${previous.length} previous stages:`, previous);
  return previous;
}

// Helper function to find parent stage name
function findParentStageName(workflowData: FetchedWorkflowStage[], parentId: string): string | null {
  function searchInStages(stages: FetchedWorkflowStage[]): string | null {
    for (const stage of stages) {
      if (stage.id === parentId) {
        return stage.name;
      }
      if (stage.sub_stages && stage.sub_stages.length > 0) {
        const found = searchInStages(stage.sub_stages);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchInStages(workflowData);
}

/**
 * Get the "Completed" stage ID for an organization
 */
export async function getCompletedStageId(
  organizationId: string,
  supabase: any
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workflow_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "Completed")
    .eq("is_default", false)
    .single();

  if (error) {
    console.error("Error fetching completed stage:", error);
    return null;
  }

  return data?.id || null;
}

/**
 * Check if the current stage is the last regular workflow stage before "Completed"
 */
export function isLastWorkflowStage(
  stageId: string,
  subStageId: string | null,
  workflowStages: FetchedWorkflowStage[]
): boolean {
  // Get all leaf stages (stages that can actually contain items)
  const allLeafStages: { id: string; path: string }[] = [];
  
  function collectLeafStages(stages: FetchedWorkflowStage[], parentPath = "") {
    stages.forEach(stage => {
      // Skip "Completed" stage
      if (stage.name === "Completed") return;
      
      const currentPath = parentPath ? `${parentPath}.${stage.sequence_order}` : stage.sequence_order.toString();
      
      if (!stage.sub_stages || stage.sub_stages.length === 0) {
        // This is a leaf stage
        allLeafStages.push({ id: stage.id, path: currentPath });
      } else {
        // Recursively collect from sub-stages
        collectLeafStages(stage.sub_stages, currentPath);
      }
    });
  }
  
  collectLeafStages(workflowStages);
  
  if (allLeafStages.length === 0) return false;
  
  // Sort by path to get the correct sequence
  allLeafStages.sort((a, b) => {
    const aPath = a.path.split('.').map(Number);
    const bPath = b.path.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
      const aVal = aPath[i] || 0;
      const bVal = bPath[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
  
  // Check if current stage is the last leaf stage
  const lastLeafStage = allLeafStages[allLeafStages.length - 1];
  return stageId === lastLeafStage.id;
}

/**
 * Determine if the next move should go to "Completed" stage
 */
export function shouldMoveToCompleted(
  currentStageId: string,
  currentSubStageId: string | null,
  workflowStages: FetchedWorkflowStage[]
): boolean {
  return isLastWorkflowStage(currentStageId, currentSubStageId, workflowStages);
}
