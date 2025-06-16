import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

// Schema for updating permissions
const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permission_key: z.string(),
      enabled: z.boolean(),
    })
  ),
});

export async function GET() {
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
      { error: "Forbidden: Only owners can view access control settings." },
      { status: 403 }
    );
  }

  try {
    // Get all permissions for the organization
    const { data: permissions, error: permissionsError } = await supabase
      .from("worker_permissions")
      .select("permission_key, enabled")
      .eq("organization_id", organizationId);

    if (permissionsError) {
      console.error("Error fetching permissions:", permissionsError);
      return NextResponse.json(
        { error: "Failed to fetch permissions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ permissions: permissions || [] });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/settings/access-control:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
      { error: "Forbidden: Only owners can update access control settings." },
      { status: 403 }
    );
  }

  // Validate request body
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updatePermissionsSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request data", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { permissions } = result.data;

  try {
    // Update permissions using upsert
    const upsertPromises = permissions.map(({ permission_key, enabled }) =>
      supabase.from("worker_permissions").upsert(
        {
          organization_id: organizationId,
          permission_key,
          enabled,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,permission_key",
        }
      )
    );

    const results = await Promise.all(upsertPromises);

    // Check for any errors
    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      console.error("Error updating permissions:", errors);
      return NextResponse.json(
        { error: "Failed to update some permissions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Permissions updated successfully",
      updated_count: permissions.length,
    });
  } catch (error) {
    console.error(
      "Unexpected error in PUT /api/settings/access-control:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
