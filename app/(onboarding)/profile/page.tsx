import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./components/profile-form";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function OnboardingProfilePage({
  searchParams,
}: PageProps) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirect("/sign-in");
    }

    // Get search parameters
    const params = await searchParams;
    const subscriptionId = params.subscription_id as string;
    const status = params.status as string;

    // If we have a subscription_id from successful payment, store it in user metadata
    if (subscriptionId && status === "active" && user) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          subscription_id: subscriptionId,
          payment_status: "completed",
        },
      });

      if (updateError) {
        console.error(
          "Error updating user metadata with subscription_id:",
          updateError
        );
      } else {
        // Redirect to clean URL after storing subscription_id

        // Redirect to clean URL after storing subscription_id
        return redirect("/profile");
      }
    }

    // Check if user has a product_id - if not, redirect to subscribe page
    // Also check if payment is not completed yet
    if (
      !user.user_metadata?.product_id ||
      user.user_metadata?.payment_status === "pending"
    ) {
      // If they have a product_id but payment is pending, redirect to payment
      if (
        user.user_metadata?.product_id &&
        user.user_metadata?.payment_status === "pending"
      ) {
        const origin = process.env.NEXT_PUBLIC_BASE_URL;
        const redirectUrl = encodeURIComponent(`${origin}/profile`);
        const productId = encodeURIComponent(user.user_metadata.product_id);
        const baseUrl =
          process.env.NODE_ENV === "development"
            ? "https://test.checkout.dodopayments.com"
            : "https://checkout.dodopayments.com";

        return redirect(
          `${baseUrl}/buy/${productId}?quantity=1&redirect_url=${redirectUrl}`
        );
      }

      // If they don't have a product_id, redirect to subscribe
      return redirect("/subscribe");
    }

    return <ProfileForm />;
  } catch (error) {
    console.error("Error in OnboardingProfilePage:", error);
    throw error;
  }
}
