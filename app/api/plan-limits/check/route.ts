import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { checkPlanLimits } from "@/lib/plan-limits";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const organizationId = profile.organization_id;

    // Check plan limits
    const limitCheck = await checkPlanLimits(organizationId, user.id);

    return NextResponse.json(limitCheck);
  } catch (error) {
    console.error("Error checking plan limits:", error);
    return NextResponse.json(
      { error: "Failed to check plan limits" },
      { status: 500 }
    );
  }
}
