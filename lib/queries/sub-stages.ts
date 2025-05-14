import { createClient } from "@/utils/supabase/client"; // Added import
// import { Database } from "../../types/supabase"; // Path issue, using any for now

export type SubStage = any; // Using any temporarily
// export type SubStage = Database["public"]["Tables"]["sub_stages"]["Row"];

/**
 * Fetches a specific sub-stage by its ID and organization ID.
 */
export async function getSubStageById(
  // supabase: SupabaseClient<any>, // Removed parameter
  subStageId: string,
  organizationId: string
): Promise<SubStage | null> {
  const supabase = await createClient(); // Create client inside the function

  const { data, error } = await supabase
    .from("workflow_sub_stages")
    .select("*")
    .eq("id", subStageId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching sub-stage:", error);
    throw new Error(`Failed to fetch sub-stage: ${error.message}`);
  }

  return data;
}
