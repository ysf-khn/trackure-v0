import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  // Also check for "redirect_to" parameter (used by password reset)
  const next =
    searchParams.get("next") ?? searchParams.get("redirect_to") ?? "/";
  // Get productId from OAuth queryParams if present
  const productId = searchParams.get("product_id");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If we have a productId from Google OAuth, we need to set up user metadata
      if (productId) {
        console.log(
          "[Auth Callback] Setting up subscription metadata for Google OAuth user"
        );

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[Auth Callback] Error getting user:", userError);
        } else if (user) {
          // Check if this is a new user (no existing product_id in metadata)
          if (!user.user_metadata?.product_id) {
            // Update user metadata with product_id and payment_status like regular sign-up
            const { error: updateError } = await supabase.auth.updateUser({
              data: {
                ...user.user_metadata,
                product_id: productId,
                payment_status: "pending",
              },
            });

            if (updateError) {
              console.error(
                "[Auth Callback] Error updating user metadata:",
                updateError
              );
            } else {
              console.log(
                "[Auth Callback] Successfully set up subscription metadata"
              );

              // Small delay to ensure metadata propagation
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error("[Auth Callback] Session exchange error:", error);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
