import { supabaseAdmin } from "@/utils/supabase/admin";

// Helper function to update user metadata
async function updateUserMetadata(
  userId: string,
  metadata: Record<string, any>
) {
  const user = await supabaseAdmin.auth.admin.getUserById(userId);
  if (user.data.user) {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.data.user.user_metadata,
        ...metadata,
      },
    });
  }
}

// Helper function to update profile onboarding status
async function updateProfileOnboardingStatus(
  userId: string,
  status: string,
  condition?: string
) {
  const query = supabaseAdmin
    .from("profiles")
    .update({ onboarding_status: status })
    .eq("id", userId);

  if (condition) {
    query.eq("onboarding_status", condition);
  }

  const { error } = await query;
  if (error) {
    console.error("Error updating profile onboarding status:", error);
  }
}

// Helper function to clean up expired cancelled subscriptions
export async function cleanupExpiredCancelledSubscriptions() {
  const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
  const now = new Date().toISOString();

  for (const user of userData.users) {
    const metadata = user.user_metadata;

    // Check if user has cancelled subscription with expired access
    if (
      metadata?.subscription_status === "cancelled" &&
      metadata?.access_expires_at &&
      new Date(metadata.access_expires_at) <= new Date(now)
    ) {
      // Update user metadata to reflect expired access
      await updateUserMetadata(user.id, {
        subscription_status: "expired",
        payment_status: "expired",
        access_expires_at: now, // Update to current time
      });

      // Reset onboarding status to require new subscription
      await updateProfileOnboardingStatus(user.id, "pending_subscription");

      console.log(
        `Cleaned up expired cancelled subscription for user: ${user.id}`
      );
    }
  }
}
