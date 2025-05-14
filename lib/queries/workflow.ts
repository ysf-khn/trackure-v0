import { type SupabaseClient } from "@supabase/supabase-js"; // Import SupabaseClient type

// TODO: Replace 'any' with actual types once Database type path is found and import uncommented
// Basic types with essential fields + itemCount
export type SubStage = {
  id: string;
  name: string;
  stage_id: string;
  itemCount: number;
  // Add other fields from workflow_sub_stages if needed
  sequence_order: number;
};
export type Stage = {
  id: string;
  name: string;
  itemCount: number;
  // Add other fields from workflow_stages if needed
  sequence_order: number;
  subStages: SubStage[];
};
export type WorkflowStructure = Stage[];
/**
 * Gets the complete workflow structure with optimized DB queries
 */
export async function getWorkflowStructure(
  supabase: SupabaseClient
): Promise<WorkflowStructure> {
  // Get the organization ID and execute in parallel with item counts
  const userPromise = supabase.auth.getUser();

  // Execute DB queries in parallel where possible
  const [
    {
      data: { user },
    },
  ] = await Promise.all([userPromise]);

  if (!user) {
    return []; // Early return if no user
  }

  // Get the user's organization ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const organizationId = profile?.organization_id;

  if (!organizationId) {
    // Try to fetch default workflow if no organization ID
    return await getDefaultWorkflow(supabase);
  }

  // Parallel queries to improve performance
  const [stagesResult, countsResult] = await Promise.all([
    // Query 1: Get organization-specific stages
    supabase
      .from("workflow_stages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sequence_order", { ascending: true }),

    // Query 2: Get counts directly from the database using GROUP BY
    supabase.rpc("get_item_counts_by_stage", { org_id: organizationId }),
  ]);

  // Handle case where org has no custom stages - fall back to defaults
  const stages = stagesResult.data || [];
  if (stages.length === 0) {
    return await getDefaultWorkflow(supabase);
  }

  // Process the counts data
  const stageCounts: Record<string, number> = {};
  const subStageCounts: Record<string, Record<string, number>> = {};

  // Initialize count data structures
  if (!countsResult.error && countsResult.data) {
    for (const row of countsResult.data) {
      const { stage_id, sub_stage_id, count } = row;

      if (sub_stage_id) {
        // Initialize the stage object if needed
        if (!subStageCounts[stage_id]) {
          subStageCounts[stage_id] = {};
        }
        subStageCounts[stage_id][sub_stage_id] = count;
      } else {
        // Count for items directly in the stage (no sub-stage)
        stageCounts[stage_id] = count;
      }
    }
  }

  // Get substages for all stages in one query
  const stageIds = stages.map((stage) => stage.id);
  const { data: subStagesData, error: subStagesError } = await supabase
    .from("workflow_sub_stages")
    .select("*")
    .in("stage_id", stageIds)
    .order("sequence_order", { ascending: true });

  if (subStagesError) {
    console.error("Error fetching workflow sub-stages:", subStagesError);
    throw new Error("Could not fetch workflow sub-stages.");
  }

  // Process sub-stages by stage ID
  const subStagesByStageId = (subStagesData || []).reduce(
    (acc, subStage) => {
      const stageId = subStage.stage_id;
      if (!acc[stageId]) {
        acc[stageId] = [];
      }

      // Add item count to sub-stage
      acc[stageId].push({
        ...subStage,
        itemCount: subStageCounts[stageId]?.[subStage.id] || 0,
      });

      return acc;
    },
    {} as Record<string, SubStage[]>
  );

  // Combine stages and sub-stages with counts
  return stages.map((stage) => {
    const subStages = subStagesByStageId[stage.id] || [];

    // Calculate total stage count (direct items + sum of sub-stage items)
    const totalStageCount =
      (stageCounts[stage.id] || 0) +
      subStages.reduce((sum: number, ss: SubStage) => sum + ss.itemCount, 0);

    return {
      ...stage,
      subStages,
      itemCount: totalStageCount,
    };
  });
}

/**
 * Get default workflow stages and sub-stages
 */
async function getDefaultWorkflow(
  supabase: SupabaseClient
): Promise<WorkflowStructure> {
  // Get default stages
  const { data: stages, error } = await supabase
    .from("workflow_stages")
    .select("*")
    .is("organization_id", null)
    .eq("is_default", true)
    .order("sequence_order", { ascending: true });

  if (error || !stages?.length) {
    console.error("Error fetching default workflow stages:", error);
    return [];
  }

  // Get default sub-stages
  const stageIds = stages.map((stage) => stage.id);
  const { data: subStagesData } = await supabase
    .from("workflow_sub_stages")
    .select("*")
    .in("stage_id", stageIds)
    .order("sequence_order", { ascending: true });

  // Group sub-stages by stage ID
  const subStagesByStageId = (subStagesData || []).reduce(
    (acc, subStage) => {
      const stageId = subStage.stage_id;
      if (!acc[stageId]) {
        acc[stageId] = [];
      }
      acc[stageId].push({
        ...subStage,
        itemCount: 0, // Default workflow has no items
      });
      return acc;
    },
    {} as Record<string, SubStage[]>
  );

  // Combine stages and sub-stages
  return stages.map((stage) => ({
    ...stage,
    subStages: subStagesByStageId[stage.id] || [],
    itemCount: 0, // Default workflow has no items
  }));
}
