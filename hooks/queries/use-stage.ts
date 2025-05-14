import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Define the structure of the stage data (adjust based on your actual table schema)
// You might want to centralize this type, perhaps in src/types/workflow.ts or similar
export interface StageData {
  id: string;
  name: string;
  description: string | null;
  sequence_order: number;
  organization_id: string | null; // Can be null for default stages
  is_default: boolean;
  location: string | null; // Optional location field
  // Add other relevant fields
}

const fetchStageById = async (
  stageId: string
  // organizationId: string | null // Removed: Currently unused, add back if RLS/logic needs it
): Promise<StageData | null> => {
  const supabase = createClient();

  // Fetch the specific stage
  // Important: Consider RLS implications. This query assumes the client has permission
  // to fetch this stage, either because it's a default stage or belongs to their org.
  const { data, error } = await supabase
    .from("workflow_stages")
    .select("*")
    .eq("id", stageId)
    .maybeSingle(); // Use maybeSingle() to handle cases where the stage might not be found

  if (error) {
    console.error("Error fetching stage by ID:", error);
    throw new Error(error.message);
  }

  // If fetching organization-specific stages, you might want an additional check based on organizationId from auth context
  // if (data && data.organization_id !== null && data.organization_id !== /* Get orgId from auth context */) {
  //   console.warn("Attempted to fetch stage from another organization.");
  //   return null; // Or throw an error
  // }

  return data;
};

export const useStage = (
  stageId: string | undefined | null,
  organizationId: string | undefined | null // Keep orgId here, might be needed for queryKey or future logic
) => {
  return useQuery<StageData | null, Error>({
    // Include organizationId in the query key if RLS depends on it,
    // or if you fetch org-specific vs default based on it.
    queryKey: ["stage", stageId, organizationId],
    queryFn: () => {
      if (!stageId) {
        return Promise.resolve(null); // Or reject if stageId is mandatory
      }
      // Pass organizationId if needed by fetchStageById logic or RLS
      return fetchStageById(stageId /* , organizationId */); // Removed orgId from call
    },
    enabled: !!stageId, // Only run the query if stageId is available
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
