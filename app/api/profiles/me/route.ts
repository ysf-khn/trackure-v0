import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(255),
});

export async function PUT(request: Request) {
  const supabase = await createClient(); // Use the server client factory

  // Get user session using the recommended approach for server-side clients
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error:", authError);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // No need for separate try/catch for session, getUser handles it

  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    console.error("Error parsing request body:", error); // Log the error
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const validation = profileUpdateSchema.safeParse(requestData);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid input", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { full_name } = validation.data;

  try {
    // Check if profile exists first to determine if this is an update or creation
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, onboarding_status")
      .eq("id", user.id)
      .single();

    if (existingProfile) {
      // Profile exists - just update the full_name, preserve existing onboarding_status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: full_name })
        .eq("id", user.id);

      if (updateError) {
        console.error("Supabase profile update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update profile", details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Profile doesn't exist - create new with onboarding status
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: full_name,
        onboarding_status: "pending_org", // Only set this for new profiles
      });

      if (insertError) {
        console.error("Supabase profile insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to create profile", details: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

// Optional: Add a GET handler if needed later, e.g., to fetch profile data
// export async function GET(request: Request) { ... }
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("GET /api/profiles/me Auth Error:", authError);
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        organization_id,
        role,
        onboarding_status
      `
      )
      .eq("id", user.id)
      .single(); // Use single() as we expect only one profile per user ID

    if (profileError) {
      if (profileError.code === "PGRST116") {
        // PGRST116: "The result contains 0 rows" - Profile doesn't exist yet
        console.warn(
          `GET /api/profiles/me: Profile not found for user ${user.id}`
        );
        // Depending on your logic, you might return a specific status or default data
        // For now, let's treat it as not found.
        return NextResponse.json(
          { message: "Profile not found" },
          { status: 404 }
        );
      }
      // Log other Supabase errors
      console.error("GET /api/profiles/me Supabase error:", profileError);
      return NextResponse.json(
        { message: "Failed to fetch profile", details: profileError.message },
        { status: 500 }
      );
    }

    if (!profile) {
      // This case might be redundant due to single() and PGRST116 check, but good for safety
      console.warn(
        `GET /api/profiles/me: Profile not found (post-query check) for user ${user.id}`
      );
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("GET /api/profiles/me Unexpected error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
