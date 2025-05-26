import { dodopayments } from "@/lib/dodopayments";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

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

    // Get subscription_id from user metadata
    const subscriptionId = user.user_metadata?.subscription_id;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Fetch subscription details from Dodo Payments
    const subscription =
      await dodopayments.subscriptions.retrieve(subscriptionId);

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription details" },
      { status: 500 }
    );
  }
}
