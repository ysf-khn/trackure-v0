import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const supabase = await createClient();

  try {
    // 1. Verify Authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify user belongs to the organization
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    const organizationId = (await params).organizationId;

    if (userProfile.organization_id !== organizationId) {
      return NextResponse.json(
        { error: "Forbidden: You don't belong to this organization" },
        { status: 403 }
      );
    }

    // 3. Fetch team members
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("organization_id", organizationId);

    if (profilesError) {
      console.error("Error fetching team member profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch team members" },
        { status: 500 }
      );
    }

    // 4. Format the response
    const formattedMembers = profiles.map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      email: null, // We'll hide email column in the UI for now
      created_at: profile.created_at,
    }));

    return NextResponse.json(formattedMembers);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
