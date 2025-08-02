import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

// Define schema for input validation (including itemId)
const reorderSchema = z.object({
  itemId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  // Auth and Org checks (Adjusted for getUserWithProfile)
  if (userProfileError || !user || !profile) {
    // Use userProfileError message
    return NextResponse.json(
      { message: userProfileError?.message || "Unauthorized" },
      { status: 401 }
    );
  }
  // Use profile.role for check
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { message: "Forbidden: Only Owners can reorder stages" },
      { status: 403 }
    );
  }
  // Use profile.organization_id
  const organizationId = profile.organization_id;
  if (!organizationId) {
    return NextResponse.json(
      { message: "User not associated with an organization" },
      { status: 400 }
    );
  }
  // --- End Auth Checks

  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Failed to parse JSON body:", error);
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const validation = reorderSchema.safeParse(body);

  if (!validation.success) {
    // Provide better error feedback
    return NextResponse.json(
      { message: "Invalid input", errors: validation.error.errors },
      { status: 400 }
    );
  }

  const { itemId, direction } = validation.data;

  try {
    // Get the current stage to reorder
    const { data: currentStage, error: currentStageError } = await supabase
      .from("workflow_stages")
      .select("id, sequence_order, parent_stage_id, organization_id, sku")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .single();

    if (currentStageError || !currentStage) {
      return NextResponse.json(
        { message: "Stage not found or does not belong to organization" },
        { status: 404 }
      );
    }

    // Get all sibling stages (stages with the same parent and SKU)
    let siblingQuery = supabase
      .from("workflow_stages")
      .select("id, sequence_order")
      .eq("organization_id", organizationId)
      .order("sequence_order", { ascending: true });

    // Filter by parent (for main stages, parent_stage_id is null)
    if (currentStage.parent_stage_id) {
      siblingQuery = siblingQuery.eq("parent_stage_id", currentStage.parent_stage_id);
    } else {
      siblingQuery = siblingQuery.is("parent_stage_id", null);
    }

    // Filter by SKU
    if (currentStage.sku) {
      siblingQuery = siblingQuery.eq("sku", currentStage.sku);
    } else {
      siblingQuery = siblingQuery.is("sku", null);
    }

    const { data: siblingStages, error: siblingsError } = await siblingQuery;

    if (siblingsError || !siblingStages) {
      return NextResponse.json(
        { message: "Failed to fetch sibling stages" },
        { status: 500 }
      );
    }

    // Find current position and target position
    const currentIndex = siblingStages.findIndex(s => s.id === itemId);
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

    // To avoid unique constraint conflicts, use a 3-step update process
    const tempSequence = Math.max(...siblingStages.map(s => s.sequence_order)) + 1000;

    // Step 1: Move current stage to temporary position
    const { error: tempUpdateError } = await supabase
      .from("workflow_stages")
      .update({ sequence_order: tempSequence })
      .eq("id", itemId)
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
        .eq("id", itemId)
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
      .eq("id", itemId)
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
        .eq("id", itemId)
        .eq("organization_id", organizationId);
      
      return NextResponse.json(
        { message: `Failed to move stage to final position: ${finalUpdateError.message}` },
        { status: 500 }
      );
    }

    // Use 200 OK for successful POST operation that modifies state
    return NextResponse.json(
      { message: "Stage reordered successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected server error reordering stage:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
