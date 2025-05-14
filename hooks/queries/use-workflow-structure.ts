"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
// Removed unused import and reference to potentially incorrect global type
// import { WorkflowStageWithSubStages } from "@/types/workflow";

// Define the specific type for the data fetched by this hook
// Export these types so they can be used by utility functions
export interface FetchedSubStage {
  id: string;
  name: string | null; // Allow null for name based on schema possibility
  sequence_order: number;
  location: string | null; // Optional location field
}

export interface FetchedWorkflowStage {
  id: string;
  name: string | null; // Allow null for name
  sequence_order: number;
  location: string | null; // Optional location field
  sub_stages: FetchedSubStage[];
}

// --- Query Key Generator --- //
// Exported for use in mutations (invalidation)
export const getWorkflowQueryKey = (organizationId: string) => [
  "workflow",
  "structure",
  organizationId,
];

// Fetch function to get workflow structure from Supabase
const fetchWorkflowStructure = async (
  organizationId: string
): Promise<FetchedWorkflowStage[]> => {
  const supabase = createClient();

  const { data: workflowStages, error: workflowError } = await supabase
    .from("workflow_stages")
    .select(
      `
      id,
      name,
      sequence_order,
      location,
      sub_stages:workflow_sub_stages ( id, name, sequence_order, location )
    `
    )
    .eq("organization_id", organizationId)
    .order("sequence_order", { ascending: true })
    .order("sequence_order", {
      foreignTable: "workflow_sub_stages",
      ascending: true,
    });

  if (workflowError) {
    console.error("Error fetching workflow structure:", workflowError);
    throw new Error(
      workflowError.message || "Failed to fetch workflow structure."
    );
  }

  // Ensure sub_stages is always an array, even if null from the query
  const formattedStages = workflowStages.map((stage) => ({
    ...stage,
    sub_stages: stage.sub_stages || [],
  }));

  // No need to cast if the fetch function's return type matches the query structure
  return formattedStages;
};

// --- TanStack Query Hook --- //
export const useWorkflowStructure = (
  organizationId: string | undefined | null
) => {
  return useQuery<FetchedWorkflowStage[], Error>({
    queryKey: ["workflow", "structure", organizationId], // Unique query key
    queryFn: () => {
      if (!organizationId) {
        // Or throw an error, or return a default value like []
        return Promise.resolve([]);
      }
      return fetchWorkflowStructure(organizationId);
    },
    enabled: !!organizationId, // Only run the query if organizationId is available
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
