import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

const reorderSchema = z.object({
  itemId: z.string().uuid(), // This will be the sub_stage_id
  direction: z.enum(["up", "down"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  
  // Use the standard getUserWithProfile helper
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  if (userProfileError || !user || !profile) {
    return NextResponse.json(
      { message: userProfileError?.message || "Unauthorized" },
      { status: 401 }
    );
  }

  const organizationId = profile.organization_id;
  const userRole = profile.role;

  // RBAC Check: Check permission for workers
  if (profile.role === "Worker") {
    // Check if worker has permission to edit workflow
    const { data: hasPermission, error: permissionError } =
      await supabase.rpc("worker_has_permission", {
        permission_key: "workflow.edit",
      });

    if (permissionError) {
      console.error("Error checking permissions:", permissionError);
      return NextResponse.json(
        { message: "Failed to verify permissions" },
        { status: 500 }
      );
    }

    if (!hasPermission) {
      return NextResponse.json(
        { message: "Forbidden: You don't have permission to edit workflow" },
        { status: 403 }
      );
    }
  } else if (profile.role !== "Owner") {
    return NextResponse.json(
      { message: "Forbidden: Only Owners can reorder sub-stages" },
      { status: 403 }
    );
  }

  // Organization ID check (redundant due to profile fetch but good practice)
  if (!organizationId) {
    // This case should technically be caught by the profile check above
    return NextResponse.json(
      { message: "User not associated with an organization" },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Failed to parse JSON body:", error);
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const validation = reorderSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: validation.error.errors },
      { status: 400 }
    );
  }

  const { itemId: subStageId, direction } = validation.data;

  try {
    // Get the current stage to reorder
    const { data: currentStage, error: currentStageError } = await supabase
      .from("workflow_stages")
      .select("id, sequence_order, parent_stage_id, organization_id")
      .eq("id", subStageId)
      .eq("organization_id", organizationId)
      .not("parent_stage_id", "is", null) // Ensure it's a sub-stage (has a parent)
      .single();

    if (currentStageError || !currentStage) {
      return NextResponse.json(
        { message: "Sub-stage not found or does not belong to organization" },
        { status: 404 }
      );
    }

    // Get all sibling stages (stages with the same parent)
    const { data: siblingStages, error: siblingsError } = await supabase
      .from("workflow_stages")
      .select("id, sequence_order")
      .eq("parent_stage_id", currentStage.parent_stage_id)
      .eq("organization_id", organizationId)
      .order("sequence_order", { ascending: true });

    if (siblingsError || !siblingStages) {
      return NextResponse.json(
        { message: "Failed to fetch sibling stages" },
        { status: 500 }
      );
    }

    // Find current position and target position
    const currentIndex = siblingStages.findIndex(s => s.id === subStageId);
    if (currentIndex === -1) {
      return NextResponse.json(
        { message: "Stage not found in siblings" },
        { status: 404 }
      );
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Check if move is valid
    if (targetIndex < 0 || targetIndex >= siblingStages.length) {
      return NextResponse.json(
        { message: `Cannot move ${direction}: already at ${direction === "up" ? "top" : "bottom"}` },
        { status: 400 }
      );
    }

    // Swap sequence orders
    const currentSequence = siblingStages[currentIndex].sequence_order;
    const targetSequence = siblingStages[targetIndex].sequence_order;

    // To avoid unique constraint conflicts, we need to temporarily set one stage to a unique value
    // then update both stages
    const tempSequence = Math.max(...siblingStages.map(s => s.sequence_order)) + 1000;
    
    console.log(`Updating stage ${subStageId} from sequence ${currentSequence} to ${targetSequence}`);
    console.log(`Updating stage ${siblingStages[targetIndex].id} from sequence ${targetSequence} to ${currentSequence}`);
    console.log(`Using temp sequence: ${tempSequence}`);

    // Step 1: Move current stage to temporary position
    const { error: tempUpdateError } = await supabase
      .from("workflow_stages")
      .update({ sequence_order: tempSequence })
      .eq("id", subStageId)
      .eq("organization_id", organizationId);

    if (tempUpdateError) {
      console.error("Error moving current stage to temp position:", tempUpdateError);
      return NextResponse.json(
        { message: `Failed to move stage to temp position: ${tempUpdateError.message}` },
        { status: 500 }
      );
    }

    // Step 2: Move target stage to current stage's original position
    const { error: swapError } = await supabase
      .from("workflow_stages")
      .update({ sequence_order: currentSequence })
      .eq("id", siblingStages[targetIndex].id)
      .eq("organization_id", organizationId);

    if (swapError) {
      console.error("Error updating target stage order:", swapError);
      // Rollback: move current stage back to original position
      await supabase
        .from("workflow_stages")
        .update({ sequence_order: currentSequence })
        .eq("id", subStageId)
        .eq("organization_id", organizationId);
      
      return NextResponse.json(
        { message: `Failed to update target stage order: ${swapError.message}` },
        { status: 500 }
      );
    }

    // Step 3: Move current stage to target's original position
    const { error: finalUpdateError } = await supabase
      .from("workflow_stages")
      .update({ sequence_order: targetSequence })
      .eq("id", subStageId)
      .eq("organization_id", organizationId);

    if (finalUpdateError) {
      console.error("Error moving current stage to final position:", finalUpdateError);
      // Rollback both changes
      await supabase
        .from("workflow_stages")
        .update({ sequence_order: targetSequence })
        .eq("id", siblingStages[targetIndex].id)
        .eq("organization_id", organizationId);
      await supabase
        .from("workflow_stages")
        .update({ sequence_order: currentSequence })
        .eq("id", subStageId)
        .eq("organization_id", organizationId);
      
      return NextResponse.json(
        { message: `Failed to move stage to final position: ${finalUpdateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Sub-stage reordered successfully" });
  } catch (error) {
    console.error("Unexpected server error reordering sub-stage:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
