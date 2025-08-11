"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
// Removed unused import and reference to potentially incorrect global type
// import { WorkflowStageWithSubStages } from "@/types/workflow";

// Define the specific type for the data fetched by this hook
// Export these types so they can be used by utility functions
export interface FetchedWorkflowStage {
  id: string;
  name: string | null; // Allow null for name
  sequence_order: number;
  location: string | null; // Optional location field
  parent_stage_id: string | null;
  depth_level: number;
  full_path: string | null;
  is_leaf_stage: boolean;
  sku: string | null;
  vendor_pricing_count?: number; // Count of active vendor pricing for this stage
  children?: FetchedWorkflowStage[]; // Recursive for infinite nesting
  is_system_stage?: boolean; // Flag to identify system stages like "Completed"
}

// --- Query Key Generator --- //
// Exported for use in mutations (invalidation)
export const getWorkflowQueryKey = (organizationId: string, selectedSKU?: string | null) => [
  "workflow",
  "structure",
  organizationId,
  selectedSKU,
];

// Build tree structure from flat array
const buildTree = (stages: any[], parentId: string | null = null): FetchedWorkflowStage[] => {
  return stages
    .filter(stage => stage.parent_stage_id === parentId)
    .map(stage => ({
      ...stage,
      vendor_pricing_count: Array.isArray(stage.vendor_stage_pricing) 
        ? stage.vendor_stage_pricing.length 
        : 0,
      is_system_stage: stage.name === 'Completed', // Flag system stages
      children: buildTree(stages, stage.id)
    }))
    .sort((a, b) => a.sequence_order - b.sequence_order);
};

// Fetch function to get workflow structure from Supabase
const fetchWorkflowStructure = async (
  organizationId: string,
  selectedSKU?: string | null
): Promise<FetchedWorkflowStage[]> => {
  const supabase = createClient();

  let query = supabase
    .from("workflow_stages")
    .select(
      `
      id,
      name,
      sequence_order,
      location,
      parent_stage_id,
      depth_level,
      full_path,
      is_leaf_stage,
      sku,
      vendor_stage_pricing!left(
        id
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("vendor_stage_pricing.is_active", true);

  // Filter by SKU if selected
  if (selectedSKU) {
    query = query.eq("sku", selectedSKU);
  } else {
    query = query.is("sku", null);
  }

  const { data: workflowStages, error: workflowError } = await query.order("sequence_order", { ascending: true });

  if (workflowError) {
    console.error("Error fetching workflow structure:", workflowError);
    throw new Error(
      workflowError.message || "Failed to fetch workflow structure."
    );
  }

  // Build the tree structure from flat data
  const treeStructure = buildTree(workflowStages || []);
  
  return treeStructure;
};

// --- TanStack Query Hook --- //
export const useWorkflowStructure = (
  organizationId: string | undefined | null,
  selectedSKU?: string | null
) => {
  return useQuery<FetchedWorkflowStage[], Error>({
    queryKey: getWorkflowQueryKey(organizationId || "", selectedSKU), // Use the key generator
    queryFn: () => {
      if (!organizationId) {
        // Or throw an error, or return a default value like []
        return Promise.resolve([]);
      }
      return fetchWorkflowStructure(organizationId, selectedSKU);
    },
    enabled: !!organizationId, // Only run the query if organizationId is available
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
