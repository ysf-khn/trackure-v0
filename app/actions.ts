"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const productId = formData.get("productId")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required"
    );
  }

  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        product_id: productId,
        payment_status: "pending",
      },
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  }

  // After successful signup, redirect back to sign-up page with success parameter
  const searchParams = new URLSearchParams();
  searchParams.set("success", "true");
  if (productId) searchParams.set("productId", productId);
  return redirect(`/sign-up?${searchParams.toString()}`);
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Handle specific cases for better UX
    if (error.message === "Invalid login credentials") {
      // For "Invalid login credentials", we can't distinguish between
      // wrong password and non-existent user for security reasons.
      // But we can provide a helpful message that guides users to sign up.
      return encodedRedirect(
        "error",
        "/sign-in",
        `We couldn't find an account with those credentials. New to Trakure? <a href="/sign-up?email=${encodeURIComponent(email)}" class="underline text-blue-300 hover:text-blue-200 font-medium">Create your account</a>`
      );
    } else if (error.message.includes("Email not confirmed")) {
      return encodedRedirect(
        "error",
        "/sign-in",
        "Please verify your email address first. Check your inbox for a verification link, or <a href='/sign-up' class='underline text-blue-300 hover:text-blue-200 font-medium'>resend verification email</a>."
      );
    } else if (error.message.includes("Too many requests")) {
      return encodedRedirect(
        "error",
        "/sign-in",
        "Too many sign-in attempts. Please wait a few minutes before trying again."
      );
    } else {
      // For any other errors, show the original message
      return encodedRedirect("error", "/sign-in", error.message);
    }
  }

  return redirect("/dashboard");
};

export const signInWithGoogleAction = async (productId?: string | null) => {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Build the callback URL with productId if provided
  let redirectTo = `${origin}/auth/callback`;
  if (productId) {
    redirectTo += `?product_id=${encodeURIComponent(productId)}`;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        next: "/dashboard",
      },
    },
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect(data.url);
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password"
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return encodedRedirect(
      "error",
      "/reset-password",
      "Password update failed"
    );
  }

  return encodedRedirect(
    "success",
    "/reset-password",
    "Password updated successfully! You can now sign in with your new password."
  );
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

export const selectPlanAction = async (formData: FormData) => {
  const productId = formData.get("productId")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!productId) {
    return encodedRedirect(
      "error",
      "/subscribe",
      "Please select a plan to continue"
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Update user metadata with selected product_id and payment status
  const { error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      product_id: productId,
      payment_status: "pending",
    },
  });

  if (error) {
    console.error("Error updating user metadata:", error);
    return encodedRedirect(
      "error",
      "/subscribe",
      "Failed to update plan selection. Please try again."
    );
  }

  // Redirect to DodoPayments checkout
  const redirectUrl = encodeURIComponent(`${origin}/profile`);
  const encodedProductId = encodeURIComponent(productId);
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? "https://test.checkout.dodopayments.com"
      : "https://checkout.dodopayments.com";

  return redirect(
    `${baseUrl}/buy/${encodedProductId}?quantity=1&redirect_url=${redirectUrl}`
  );
};
