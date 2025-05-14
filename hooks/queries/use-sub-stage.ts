import { getSubStageById, SubStage } from "@/lib/queries/sub-stages";
import { useQuery } from "@tanstack/react-query";
// import { useSupabase } from "../../providers/supabase-provider"; // Removed

export const useSubStage = (
  subStageId: string | null, // Allow null
  organizationId: string | undefined
) => {
  // const { supabase } = useSupabase(); // Removed

  return useQuery<SubStage | null, Error>({
    queryKey: ["subStage", subStageId, organizationId], // Include org ID in key
    queryFn: async () => {
      if (!subStageId || !organizationId /* || !supabase */) {
        // Removed supabase check
        // Don't fetch if required params are missing
        return null;
      }
      // Pass client instance directly if needed by the query function
      // Now getSubStageById creates its own client
      return getSubStageById(subStageId, organizationId);
    },
    enabled: !!subStageId && !!organizationId /* && !!supabase */, // Removed supabase check
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Optional: prevent refetch on window focus
  });
};
