import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server"; // Use createClient from server
import { getUserWithProfile } from "@/utils/supabase/queries"; // Use getUserWithProfile

const createSubStageSchema = z.object({
  name: z.string().min(1, "Sub-stage name cannot be empty."),
  location: z.string().optional(), // Optional location field
  sequence_order: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  // Await client creation
  const supabase = await createClient();
  // Use getUserWithProfile
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  // Check for authentication errors or missing data
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

  // Role Check: Use the role from the fetched profile
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient privileges. Owner role required." },
      { status: 403 }
    );
  }

  const { stageId } = await params;
  if (!stageId) {
    return NextResponse.json(
      { error: "Parent stage ID is required." },
      { status: 400 }
    );
  }

  // Validate parent stage ownership and get its details
  const { data: parentStage, error: parentStageError } = await supabase
    .from("workflow_stages")
    .select("id, depth_level, sku")
    .eq("id", stageId)
    .eq("organization_id", organizationId) // Use organizationId from profile
    .single();

  if (parentStageError || !parentStage) {
    return NextResponse.json(
      {
        error:
          parentStageError?.message ||
          "Parent stage not found or access denied.",
      },
      { status: 404 }
    );
  }

  // Validate request body
  let payload;
  try {
    payload = await request.json();
  } catch {
    // No need to bind the error variable if unused
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createSubStageSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, location, sequence_order } = result.data;

  // Insert the new sub-stage in workflow_stages table (tree structure)
  const { data: newSubStage, error: insertError } = await supabase
    .from("workflow_stages")
    .insert({
      name,
      location,
      sequence_order,
      parent_stage_id: stageId, // Set parent to create tree hierarchy
      organization_id: organizationId,
      depth_level: (parentStage.depth_level || 0) + 1,
      is_leaf_stage: true, // New stages are leaf stages by default
      sku: parentStage.sku, // Inherit SKU from parent
    })
    .select()
    .single();
    
  // Update parent stage to not be a leaf
  if (!insertError) {
    await supabase
      .from("workflow_stages")
      .update({ is_leaf_stage: false })
      .eq("id", stageId);
  }

  if (insertError) {
    console.error("Error inserting sub-stage:", insertError);
    // Provide more specific error if possible (e.g., unique constraint violation)
    return NextResponse.json(
      { error: insertError.message || "Failed to create sub-stage." },
      { status: 500 }
    );
  }

  return NextResponse.json(newSubStage, { status: 201 });
}
