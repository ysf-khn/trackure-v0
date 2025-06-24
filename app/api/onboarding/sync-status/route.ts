import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Sync onboarding status - Auth error:", userError);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    // Fetch current profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_status")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(
        `Sync onboarding status - Profile fetch error for user ${user.id}:`,
        profileError
      );
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (!profile) {
      console.error(
        `Sync onboarding status - Profile not found for user ${user.id}`
      );
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check if user has subscription metadata but profile status is still pending_subscription
    const hasSubscription =
      user.user_metadata?.product_id &&
      (user.user_metadata?.payment_status === "completed" ||
        user.user_metadata?.subscription_status === "active");

    let newStatus = profile.onboarding_status;
    let statusChanged = false;

    if (
      profile.onboarding_status === "pending_subscription" &&
      hasSubscription
    ) {
      newStatus = "pending_profile";
      statusChanged = true;
    }

    if (statusChanged) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ onboarding_status: newStatus })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating onboarding status:", updateError);
        return NextResponse.json(
          { error: "Failed to sync onboarding status" },
          { status: 500 }
        );
      }

      console.log(
        `Synced onboarding status for user ${user.id}: ${profile.onboarding_status} -> ${newStatus}`
      );
    }

    return NextResponse.json({
      message: statusChanged
        ? "Onboarding status synced"
        : "Onboarding status already correct",
      oldStatus: profile.onboarding_status,
      newStatus: newStatus,
      hasSubscription: hasSubscription,
      userMetadata: {
        product_id: !!user.user_metadata?.product_id,
        payment_status: user.user_metadata?.payment_status,
        subscription_status: user.user_metadata?.subscription_status,
      },
    });
  } catch (error) {
    console.error("Sync onboarding status failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
