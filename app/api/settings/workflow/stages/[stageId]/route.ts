import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

type Stage = {
  id: string;
  name: string;
  organization_id: string;
  sequence_order: number;
};

const stageEditSchema = z.object({
  name: z.string().min(1, "Stage name cannot be empty."),
});

const updateStageSchema = z.object({
  name: z.string().min(1, "Stage name cannot be empty."),
  location: z.string().optional(),
});

async function checkStageOwnership(
  supabase: SupabaseClient,
  stageId: string,
  organization_id: string
): Promise<Stage | null> {
  const { data: stage, error } = await supabase
    .from("workflow_stages")
    .select("*")
    .eq("id", stageId)
    .eq("organization_id", organization_id)
    .maybeSingle();

  if (error) {
    console.error(
      `Error checking stage ownership for stage ${stageId}:`,
      error
    );
    return null;
  }
  return stage as Stage | null;
}

export async function PUT(
  request: Request,
  { params }: { params: { stageId: string } }
) {
  const supabase = await createClient();
  const { stageId } = await params;

  if (!stageId) {
    return NextResponse.json(
      { error: "Stage ID is required." },
      { status: 400 }
    );
  }

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

    if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Only Owners can edit stages." },
        { status: 403 }
      );
    }

    const organization_id = profile.organization_id;

    // Verify ownership
    const existingStage = await checkStageOwnership(
      supabase,
      stageId,
      organization_id
    );
    if (!existingStage) {
      return NextResponse.json(
        { error: "Stage not found or access denied." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateStageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, location } = validation.data;

    // Update stage name and location
    const { data: updatedStageData, error: updateError } = await supabase
      .from("workflow_stages")
      .update({
        name: name,
        location: location,
      })
      .eq("id", stageId)
      .eq("organization_id", organization_id)
      .select()
      .single();

    if (updateError) {
      console.error(`Error updating stage ${stageId}:`, updateError);
      return NextResponse.json(
        { error: "Failed to update stage." },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedStageData);
  } catch (error) {
    console.error(
      `Error in PUT /api/settings/workflow/stages/${stageId}:`,
      error
    );
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { stageId: string } }
) {
  const supabase = await createClient();
  const { stageId } = await params;

  if (!stageId) {
    return NextResponse.json(
      { error: "Stage ID is required." },
      { status: 400 }
    );
  }

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

    if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Only Owners can delete stages." },
        { status: 403 }
      );
    }

    const organization_id = profile.organization_id;

    // Verify ownership
    const existingStage = await checkStageOwnership(
      supabase,
      stageId,
      organization_id
    );
    if (!existingStage) {
      return NextResponse.json(
        { error: "Stage not found or access denied." },
        { status: 404 }
      );
    }

    // Check if any items are currently in this stage
    const { error: itemsCheckError, count } = await supabase
      .from("item_stage_allocations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .eq("stage_id", stageId);

    if (itemsCheckError) {
      console.error(
        `Error checking items in stage ${stageId}:`,
        itemsCheckError
      );
      return NextResponse.json(
        { error: "Failed to verify stage usage." },
        { status: 500 }
      );
    }

    if (count !== null && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete stage "${existingStage.name}" because ${count} item(s) are currently in it. Please move items before deleting.`,
          code: "STAGE_IN_USE",
        },
        { status: 409 }
      ); // Conflict
    }

    // Proceed with deletion
    const { error: deleteError } = await supabase
      .from("workflow_stages")
      .delete()
      .eq("id", stageId)
      .eq("organization_id", organization_id);

    if (deleteError) {
      console.error(`Error deleting stage ${stageId}:`, deleteError);
      return NextResponse.json(
        { error: "Failed to delete stage." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Stage deleted successfully." },
      { status: 200 }
    ); // Or 204 No Content
  } catch (error) {
    console.error(
      `Error in DELETE /api/settings/workflow/stages/${stageId}:`,
      error
    );
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
