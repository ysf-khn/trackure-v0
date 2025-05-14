import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const reorderSchema = z.object({
  itemId: z.string().uuid(), // This will be the sub_stage_id
  direction: z.enum(["up", "down"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  // --- Start: Standard Auth & Profile Fetch --- //
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error [Sub-Stage Reorder]:", authError);
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id || !profile.role) {
    console.error(
      `Profile Error/Missing Data [Sub-Stage Reorder] for user ${user.id}:`,
      profileError?.message
    );
    return NextResponse.json(
      {
        message:
          profileError?.message ||
          "Unauthorized: User profile, organization, or role mapping not found.",
      },
      { status: 401 } // Treat missing profile/org/role as auth issue
    );
  }
  const organizationId = profile.organization_id;
  const userRole = profile.role;
  // --- End: Standard Auth & Profile Fetch --- //

  // RBAC Check
  if (userRole !== "Owner") {
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
    // Prefer using a database function for atomic reordering
    // Assumes a similar RPC function `reorder_workflow_sub_stage` exists
    const { error: rpcError } = await supabase.rpc(
      "reorder_workflow_sub_stage",
      {
        p_organization_id: organizationId,
        p_sub_stage_id: subStageId,
        p_direction: direction,
      }
    );

    if (rpcError) {
      console.error("Error calling reorder_workflow_sub_stage RPC:", rpcError);
      if (rpcError.message.includes("not found")) {
        return NextResponse.json(
          { message: "Sub-stage not found or does not belong to organization" },
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
        { message: "Database error during sub-stage reorder" },
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
