import { Webhook } from "standardwebhooks";
import { headers } from "next/headers";
import { dodopayments } from "@/lib/dodopayments";
import { supabaseAdmin } from "@/utils/supabase/admin";

const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY!);

// Helper function to find user by email
async function findUserByEmail(email: string) {
  const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
  return userData.users.find((u) => u.email === email);
}

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

export async function POST(request: Request) {
  const headersList = await headers();

  try {
    const rawBody = await request.text();
    const webhookHeaders = {
      "webhook-id": headersList.get("webhook-id") || "",
      "webhook-signature": headersList.get("webhook-signature") || "",
      "webhook-timestamp": headersList.get("webhook-timestamp") || "",
    };
    await webhook.verify(rawBody, webhookHeaders);
    const payload = JSON.parse(rawBody);

    console.log(`Processing webhook event: ${payload.type}`);

    if (payload.data.payload_type === "Subscription") {
      await handleSubscriptionEvents(payload);
    } else if (payload.data.payload_type === "Payment") {
      await handlePaymentEvents(payload);
    } else if (payload.data.payload_type === "Refund") {
      await handleRefundEvents(payload);
    } else if (payload.data.payload_type === "Dispute") {
      await handleDisputeEvents(payload);
    } else if (payload.data.payload_type === "LicenseKey") {
      await handleLicenseKeyEvents(payload);
    } else {
      // Fallback for events that don't specify payload_type
      await handleGenericEvents(payload);
    }

    return Response.json(
      { message: "Webhook processed successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error processing webhook:", err);
    return Response.json(
      { error: "Error processing webhook" },
      { status: 400 }
    );
  }
}

async function handleSubscriptionEvents(payload: any) {
  const subscriptionId = payload.data.subscription_id;

  switch (payload.type) {
    case "subscription.active":
      const subscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      console.log("Subscription activated:", subscription);

      const user = await findUserByEmail(subscription.customer.email);
      if (user) {
        await updateUserMetadata(user.id, {
          payment_status: "completed",
          subscription_id: subscriptionId,
          subscription_status: "active",
        });

        await updateProfileOnboardingStatus(
          user.id,
          "pending_profile",
          "pending_subscription"
        );
        console.log("User updated for active subscription:", user.id);
      } else {
        console.log(
          "User not found for subscription:",
          subscription.customer.email
        );
      }
      break;

    case "subscription.on_hold":
      const onHoldSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const onHoldUser = await findUserByEmail(
        onHoldSubscription.customer.email
      );
      if (onHoldUser) {
        await updateUserMetadata(onHoldUser.id, {
          subscription_status: "on_hold",
          payment_status: "on_hold",
        });
        console.log("Subscription put on hold:", onHoldUser.id);
      }
      break;

    case "subscription.renewed":
      const renewedSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const renewedUser = await findUserByEmail(
        renewedSubscription.customer.email
      );
      if (renewedUser) {
        await updateUserMetadata(renewedUser.id, {
          subscription_status: "active",
          payment_status: "completed",
          last_renewed_at: new Date().toISOString(),
        });
        console.log("Subscription renewed:", renewedUser.id);
      }
      break;

    case "subscription.paused":
      const pausedSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const pausedUser = await findUserByEmail(
        pausedSubscription.customer.email
      );
      if (pausedUser) {
        await updateUserMetadata(pausedUser.id, {
          subscription_status: "paused",
        });
        console.log("Subscription paused:", pausedUser.id);
      }
      break;

    case "subscription.plan_changed":
      const changedSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const changedUser = await findUserByEmail(
        changedSubscription.customer.email
      );
      if (changedUser) {
        await updateUserMetadata(changedUser.id, {
          subscription_status: "active",
          plan_changed_at: new Date().toISOString(),
          // You might want to store new plan details here
        });
        console.log("Subscription plan changed:", changedUser.id);
      }
      break;

    case "subscription.cancelled":
      const cancelledSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const cancelledUser = await findUserByEmail(
        cancelledSubscription.customer.email
      );
      if (cancelledUser) {
        await updateUserMetadata(cancelledUser.id, {
          subscription_status: "cancelled",
          payment_status: "cancelled",
          cancelled_at: new Date().toISOString(),
        });

        // Reset onboarding status to require new subscription
        await updateProfileOnboardingStatus(
          cancelledUser.id,
          "pending_subscription"
        );
        console.log("Subscription cancelled:", cancelledUser.id);
      }
      break;

    case "subscription.failed":
      const failedSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const failedUser = await findUserByEmail(
        failedSubscription.customer.email
      );
      if (failedUser) {
        await updateUserMetadata(failedUser.id, {
          subscription_status: "failed",
          payment_status: "failed",
          failed_at: new Date().toISOString(),
        });
        console.log("Subscription failed:", failedUser.id);
      }
      break;

    case "subscription.expired":
      const expiredSubscription =
        await dodopayments.subscriptions.retrieve(subscriptionId);
      const expiredUser = await findUserByEmail(
        expiredSubscription.customer.email
      );
      if (expiredUser) {
        await updateUserMetadata(expiredUser.id, {
          subscription_status: "expired",
          payment_status: "expired",
          expired_at: new Date().toISOString(),
        });

        // Reset onboarding status to require new subscription
        await updateProfileOnboardingStatus(
          expiredUser.id,
          "pending_subscription"
        );
        console.log("Subscription expired:", expiredUser.id);
      }
      break;

    default:
      console.log("Unhandled subscription event:", payload.type);
  }
}

async function handlePaymentEvents(payload: any) {
  const paymentId = payload.data.payment_id;

  switch (payload.type) {
    case "payment.succeeded":
      const payment = await dodopayments.payments.retrieve(paymentId);
      console.log("Payment succeeded:", payment);

      const user = await findUserByEmail(payment.customer.email);
      if (user) {
        await updateUserMetadata(user.id, {
          payment_status: "completed",
          subscription_id: payment.subscription_id,
          last_payment_at: new Date().toISOString(),
        });

        await updateProfileOnboardingStatus(
          user.id,
          "pending_profile",
          "pending_subscription"
        );
        console.log("User updated for successful payment:", user.id);
      } else {
        console.log("User not found for payment:", payment.customer.email);
      }
      break;

    case "payment.failed":
      const failedPayment = await dodopayments.payments.retrieve(paymentId);
      const failedUser = await findUserByEmail(failedPayment.customer.email);
      if (failedUser) {
        await updateUserMetadata(failedUser.id, {
          payment_status: "failed",
          last_payment_failed_at: new Date().toISOString(),
        });
        console.log("Payment failed for user:", failedUser.id);
      }
      break;

    case "payment.processing":
      const processingPayment = await dodopayments.payments.retrieve(paymentId);
      const processingUser = await findUserByEmail(
        processingPayment.customer.email
      );
      if (processingUser) {
        await updateUserMetadata(processingUser.id, {
          payment_status: "processing",
        });
        console.log("Payment processing for user:", processingUser.id);
      }
      break;

    case "payment.cancelled":
      const cancelledPayment = await dodopayments.payments.retrieve(paymentId);
      const cancelledUser = await findUserByEmail(
        cancelledPayment.customer.email
      );
      if (cancelledUser) {
        await updateUserMetadata(cancelledUser.id, {
          payment_status: "cancelled",
          payment_cancelled_at: new Date().toISOString(),
        });
        console.log("Payment cancelled for user:", cancelledUser.id);
      }
      break;

    default:
      console.log("Unhandled payment event:", payload.type);
  }
}

async function handleRefundEvents(payload: any) {
  const refundId = payload.data.refund_id;

  switch (payload.type) {
    case "refund.succeeded":
      // You'll need to implement dodopayments.refunds.retrieve if not available
      console.log("Refund succeeded:", refundId);
      // const refund = await dodopayments.refunds.retrieve(refundId);
      // Handle refund success - might want to revoke access or update subscription status
      break;

    case "refund.failed":
      console.log("Refund failed:", refundId);
      // Handle refund failure
      break;

    default:
      console.log("Unhandled refund event:", payload.type);
  }
}

async function handleDisputeEvents(payload: any) {
  const disputeId = payload.data.dispute_id;

  switch (payload.type) {
    case "dispute.opened":
      console.log("Dispute opened:", disputeId);
      // You might want to pause user access or send admin notification
      break;

    case "dispute.expired":
      console.log("Dispute expired:", disputeId);
      break;

    case "dispute.accepted":
      console.log("Dispute accepted:", disputeId);
      // Handle accepted dispute - might need to process refund or revoke access
      break;

    case "dispute.cancelled":
      console.log("Dispute cancelled:", disputeId);
      break;

    case "dispute.challenged":
      console.log("Dispute challenged:", disputeId);
      break;

    case "dispute.won":
      console.log("Dispute won:", disputeId);
      // Restore user access if it was paused
      break;

    case "dispute.lost":
      console.log("Dispute lost:", disputeId);
      // Handle lost dispute - revoke access, process chargeback
      break;

    default:
      console.log("Unhandled dispute event:", payload.type);
  }
}

async function handleLicenseKeyEvents(payload: any) {
  switch (payload.type) {
    case "license_key.created":
      const licenseKeyId = payload.data.license_key_id;
      console.log("License key created:", licenseKeyId);
      // You might want to store the license key info for the user
      break;

    default:
      console.log("Unhandled license key event:", payload.type);
  }
}

async function handleGenericEvents(payload: any) {
  // Fallback for events that might not have the payload_type field
  // or for backward compatibility
  switch (payload.type) {
    case "payment.succeeded":
      if (payload.data.payment_id) {
        await handlePaymentEvents(payload);
      }
      break;

    default:
      console.log("Unhandled generic event:", payload.type);
  }
}
