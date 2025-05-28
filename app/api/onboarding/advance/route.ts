import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  try {
    // 1. Get User
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Advance Onboarding - Auth Error:", userError);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    // 2. Fetch current profile to verify status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_status")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(
        `Advance Onboarding - Profile fetch error for user ${user.id}:`,
        profileError
      );
      return NextResponse.json(
        { error: "Failed to fetch user profile." },
        { status: 500 }
      );
    }

    if (!profile) {
      console.error(
        `Advance Onboarding - Profile not found for user ${user.id}.`
      );
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    // 3. Check if status is correct for this step
    if (profile.onboarding_status !== "pending_workflow") {
      console.warn(
        `Advance Onboarding - User ${user.id} tried to advance from unexpected status: ${profile.onboarding_status}`
      );
      // Allow advancing anyway? Or return error? For now, let's allow it but log.
      // return NextResponse.json({ error: "Invalid onboarding state for this action." }, { status: 400 });
    }

    // 4. Update onboarding status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarding_status: "complete" })
      .eq("id", user.id);

    if (updateError) {
      console.error(
        `Advance Onboarding - Profile update error for user ${user.id}:`,
        updateError
      );
      return NextResponse.json(
        { error: "Failed to update onboarding status." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Advance Onboarding - Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
