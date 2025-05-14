import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  const supabase = await createClient();

  try {
    // 1. Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Error fetching user:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch user's profile to check current status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, onboarding_status")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError.message);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    // 3. Check if user is in the correct onboarding step
    // It's okay to complete from 'pending_invites' or even earlier steps if they skip
    // but not if already 'complete'.
    if (profile.onboarding_status === "complete") {
      console.log("User onboarding already complete.");
      // Still return success as the end state is achieved
      return NextResponse.json(
        { message: "Onboarding already complete" },
        { status: 200 }
      );
    }

    // 4. Update profile status to 'complete'
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarding_status: "complete" })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile status:", updateError.message);
      return NextResponse.json(
        { error: "Failed to update onboarding status" },
        { status: 500 }
      );
    }

    console.log(`User ${user.id} onboarding marked as complete.`);
    return NextResponse.json(
      { message: "Onboarding completed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in /api/onboarding/complete:", error);
    let errorMessage = "An unexpected error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
