import { dodopayments } from "@/lib/dodopayments";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
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

    const subscriptionId = user.user_metadata?.subscription_id;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No subscription ID found in user metadata" },
        { status: 404 }
      );
    }

    // Fetch subscription details from DodoPayments
    const subscription =
      await dodopayments.subscriptions.retrieve(subscriptionId);

    console.log("Syncing subscription metadata:", {
      subscriptionId,
      status: subscription.status,
      productId: subscription.product_id,
    });

    // Update user metadata with current subscription status
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        subscription_status: subscription.status,
        product_id: subscription.product_id,
        payment_status:
          subscription.status === "active" ? "completed" : subscription.status,
        last_synced_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      console.error("Error updating user metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to update user metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription metadata synced successfully",
      subscription: {
        id: subscriptionId,
        status: subscription.status,
        product_id: subscription.product_id,
      },
    });
  } catch (error) {
    console.error("Error syncing subscription metadata:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription metadata" },
      { status: 500 }
    );
  }
}
