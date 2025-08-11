import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

export async function POST() {
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

    // Only allow owners to run this admin function
    if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Only owners can run admin functions" },
        { status: 403 }
      );
    }

    console.log("Ensuring completion stages exist...");

    // Check if completion stages exist for this organization
    const { data: existingStages, error: checkError } = await supabase
      .from("workflow_stages")
      .select("id, name, sequence_order")
      .eq("organization_id", profile.organization_id)
      .eq("name", "Completed");

    if (checkError) {
      console.error("Error checking existing stages:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing stages" },
        { status: 500 }
      );
    }

    console.log("Existing completion stages:", existingStages);

    if (existingStages && existingStages.length > 0) {
      return NextResponse.json({
        message: "Completion stage already exists",
        existing: existingStages,
      });
    }

    // Create completion stage using the migration function
    const { data: result, error: createError } = await supabase.rpc(
      "create_completed_stage_for_organization",
      { p_organization_id: profile.organization_id }
    );

    if (createError) {
      console.error("Error creating completion stage:", createError);
      return NextResponse.json(
        { error: "Failed to create completion stage", details: createError.message },
        { status: 500 }
      );
    }

    console.log("Created completion stage with ID:", result);

    // Fetch the created stage to confirm
    const { data: createdStage, error: fetchError } = await supabase
      .from("workflow_stages")
      .select("id, name, sequence_order")
      .eq("id", result)
      .single();

    if (fetchError) {
      console.error("Error fetching created stage:", fetchError);
    }

    return NextResponse.json({
      message: "Completion stage created successfully",
      stageId: result,
      createdStage: createdStage,
    });

  } catch (error) {
    console.error("Unexpected error in ensure completion stages:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}