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
    // Pass all required parameters to RPC
    const { error: rpcError } = await supabase.rpc("reorder_workflow_stage", {
      p_organization_id: organizationId,
      p_stage_id: itemId,
      p_direction: direction,
    });

    // Improved RPC error handling (similar to sub-stage route)
    if (rpcError) {
      console.error("Error calling reorder_workflow_stage RPC:", rpcError);
      if (rpcError.message.includes("not found")) {
        return NextResponse.json(
          { message: "Stage not found or does not belong to organization" },
          { status: 404 }
        );
      }
      if (rpcError.message.includes("cannot move")) {
        return NextResponse.json(
          { message: rpcError.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Database error during reorder operation" },
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
