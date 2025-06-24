import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Define the schema for the request body
const organizationSetupSchema = z.object({
  organizationName: z.string().min(1, "Organization name cannot be empty."),
});

export const POST = async (req: NextRequest) => {
  const supabase = await createClient();

  // 1. Verify Authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch user profile and check onboarding status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_status, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return NextResponse.json(
      { error: "Failed to fetch user profile." },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "User profile not found." },
      { status: 404 }
    );
  }

  // Ensure user is in the correct onboarding step
  if (profile.onboarding_status !== "pending_org") {
    return NextResponse.json(
      { error: "Invalid onboarding state for organization setup." },
      { status: 400 }
    );
  }

  // User should not have an organization assigned yet in this step
  if (profile.organization_id) {
    return NextResponse.json(
      { error: "User already belongs to an organization." },
      { status: 400 }
    );
  }

  // 3. Validate Request Body
  let validatedData;
  try {
    const body = await req.json();
    validatedData = organizationSetupSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error parsing request body:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { organizationName } = validatedData;

  // 4. Perform DB Transaction

  try {
    // Use a database transaction to ensure proper ordering
    const { data, error: transactionError } = await supabase.rpc(
      "create_organization_with_owner",
      {
        p_user_id: user.id,
        p_organization_name: organizationName,
      }
    );

    if (transactionError) {
      console.error(
        "Error in organization creation transaction:",
        transactionError
      );
      return NextResponse.json(
        { error: "Failed to create organization." },
        { status: 500 }
      );
    }

    // 5. Return Success
    return NextResponse.json({ success: true, organizationId: data });
  } catch (error) {
    console.error("Unexpected error during organization setup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// Optional: Add OPTIONS handler if needed for CORS preflight
export const OPTIONS = async (/* req: NextRequest */) => {
  return NextResponse.json({}, { status: 200 });
};
