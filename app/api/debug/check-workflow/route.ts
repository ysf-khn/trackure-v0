import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

export async function GET() {
  const supabase = await createClient();

  try {
    const {
      user,
      profile,
      error: userProfileError,
    } = await getUserWithProfile(supabase);

    if (userProfileError || !user || !profile) {
      return NextResponse.json(
        { error: userProfileError?.message || "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all workflow stages for this organization
    const { data: stages, error: stagesError } = await supabase
      .from("workflow_stages")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("sequence_order");

    if (stagesError) {
      return NextResponse.json(
        { error: "Failed to fetch stages", details: stagesError.message },
        { status: 500 }
      );
    }

    // Check if completion stage exists
    const completionStages = stages?.filter(s => s.name === "Completed") || [];
    const hasCompletionStage = completionStages.length > 0;

    return NextResponse.json({
      organizationId: profile.organization_id,
      totalStages: stages?.length || 0,
      hasCompletionStage,
      completionStages,
      allStages: stages?.map(s => ({ 
        id: s.id, 
        name: s.name, 
        sequence_order: s.sequence_order,
        is_leaf_stage: s.is_leaf_stage,
        parent_stage_id: s.parent_stage_id
      })),
    });

  } catch (error) {
    console.error("Unexpected error in debug check:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}