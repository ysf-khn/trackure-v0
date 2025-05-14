import { WorkflowStructure } from "@/lib/queries/workflow";
import { useQuery } from "@tanstack/react-query";

// Helper function for the query key, INCLUDING organizationId for cache separation
export const getSidebarWorkflowKey = (organizationId: string) => [
  "workflow",
  "sidebar", // Distinguishes from structure query
  organizationId, // Essential for multi-tenant cache safety
];

// Define the fetcher function
const fetchWorkflowStructure = async (): Promise<WorkflowStructure> => {
  // API endpoint /api/workflow is assumed to derive organization from the user's session
  const response = await fetch("/api/workflow");
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `HTTP error! status: ${response.status}`
    );
  }
  return response.json();
};

// The hook itself might not need the organizationId if the API handles scoping,
// but the key GENERATOR used for invalidation DOES need it.
export function useWorkflow(organizationId?: string) {
  // We accept an optional organizationId here. If provided, it's used in the key.
  // If not provided (e.g., called from sidebar where context might be unavailable),
  // we might use a default/placeholder or rely on the API scoping solely.
  // For robust caching, providing the ID is better.
  // If the ID isn't easily available here, the API MUST handle org scoping reliably.
  const queryKey = organizationId
    ? getSidebarWorkflowKey(organizationId)
    : ["workflow", "sidebar", "unknown"]; // Fallback key if ID not passed

  return useQuery<WorkflowStructure, Error>({
    queryKey: queryKey,
    queryFn: fetchWorkflowStructure,
    // Enable based on whether a somewhat valid key is constructed
    // Or maybe it should always be enabled and rely on API session?
    // Let's keep it simple and assume it should run if called.
    // enabled: !!organizationId, // Removing this constraint for now
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
