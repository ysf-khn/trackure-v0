import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

// Schema for updating only the name
const updateSubStageSchema = z.object({
  name: z.string().min(1, "Sub-stage name cannot be empty."),
  location: z.string().optional(), // Optional location field
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ subStageId: string }> }
) {
  const supabase = await createClient();
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  if (
    userProfileError ||
    !user ||
    !profile?.organization_id ||
    !profile?.role
  ) {
    return NextResponse.json(
      {
        error:
          userProfileError?.message ||
          "Authentication failed or profile incomplete",
      },
      { status: 401 }
    );
  }

  const organizationId = profile.organization_id;

  // Role Check: Owner only
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient privileges. Owner role required." },
      { status: 403 }
    );
  }

  const { subStageId } = await params;
  if (!subStageId) {
    return NextResponse.json(
      { error: "Sub-stage ID is required." },
      { status: 400 }
    );
  }

  // Validate request body
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updateSubStageSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, location } = result.data;

  // Update the sub-stage
  // RLS policy should enforce organization_id check, but we can add it explicitly for safety
  const { data: updatedSubStage, error: updateError } = await supabase
    .from("workflow_sub_stages")
    .update({
      name,
      location, // Add location field
    })
    .eq("id", subStageId)
    .eq("organization_id", organizationId) // Ensure user owns this sub-stage
    .select()
    .single();

  if (updateError) {
    console.error("Error updating sub-stage:", updateError);
    // Handle potential errors like sub-stage not found (PostgREST returns error for eq filter mismatch on update)
    if (updateError.code === "PGRST204") {
      // PostgREST code for no rows found
      return NextResponse.json(
        { error: "Sub-stage not found or access denied." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: updateError.message || "Failed to update sub-stage." },
      { status: 500 }
    );
  }

  // If update was successful but returned no data (should not happen with .single() unless error)
  if (!updatedSubStage) {
    return NextResponse.json(
      { error: "Sub-stage not found after update attempt." },
      { status: 404 }
    );
  }

  return NextResponse.json(updatedSubStage);
}

export async function DELETE(
  request: Request, // Keep request param even if unused for consistency
  { params }: { params: { subStageId: string } }
) {
  const supabase = await createClient();
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  if (
    userProfileError ||
    !user ||
    !profile?.organization_id ||
    !profile?.role
  ) {
    return NextResponse.json(
      {
        error:
          userProfileError?.message ||
          "Authentication failed or profile incomplete",
      },
      { status: 401 }
    );
  }

  const organizationId = profile.organization_id;

  // Role Check: Owner only
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient privileges. Owner role required." },
      { status: 403 }
    );
  }

  const { subStageId } = await params;
  if (!subStageId) {
    return NextResponse.json(
      { error: "Sub-stage ID is required." },
      { status: 400 }
    );
  }

  // --- Deletion Logic ---

  // 1. Verify ownership of the sub-stage (check if it exists for the org)
  const { data: subStageCheck, error: checkError } = await supabase
    .from("workflow_sub_stages")
    .select("id")
    .eq("id", subStageId)
    .eq("organization_id", organizationId)
    .maybeSingle(); // Use maybeSingle to check existence without erroring if not found initially

  if (checkError) {
    console.error("Error checking sub-stage existence:", checkError);
    return NextResponse.json(
      { error: checkError.message || "Error verifying sub-stage." },
      { status: 500 }
    );
  }

  if (!subStageCheck) {
    return NextResponse.json(
      { error: "Sub-stage not found or access denied." },
      { status: 404 }
    );
  }

  // 2. Check if any items are currently using this sub-stage
  const { error: itemsCheckError, count } = await supabase
    .from("item_stage_allocations") // Changed from "items"
    .select("id", { count: "exact", head: true }) // Efficiently count without retrieving data
    .eq("sub_stage_id", subStageId) // Changed from "current_sub_stage_id"
    .eq("organization_id", organizationId); // Ensure check is within the org

  if (itemsCheckError) {
    console.error("Error checking items in sub-stage:", itemsCheckError);
    return NextResponse.json(
      {
        error: itemsCheckError.message || "Failed to check items in sub-stage.",
      },
      { status: 500 }
    );
  }

  if (count !== null && count > 0) {
    // V1 Strategy: Prevent deletion if items exist
    return NextResponse.json(
      {
        error: `Cannot delete sub-stage: ${count} item(s) currently reside in it.`,
      },
      { status: 409 } // 409 Conflict
    );
  }

  // 3. Delete the sub-stage if checks pass
  const { error: deleteError } = await supabase
    .from("workflow_sub_stages")
    .delete()
    .eq("id", subStageId)
    .eq("organization_id", organizationId); // Redundant due to check above, but safe

  if (deleteError) {
    console.error("Error deleting sub-stage:", deleteError);
    // Handle potential FK constraint issues if not using ON DELETE CASCADE
    return NextResponse.json(
      { error: deleteError.message || "Failed to delete sub-stage." },
      { status: 500 }
    );
  }

  // Deletion successful
  return new NextResponse(null, { status: 204 }); // 204 No Content on successful deletion
}
