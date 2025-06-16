import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as z from "zod";
import { canAddUser } from "@/lib/plan-limits";

// Required ENV vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceRoleKey) {
  console.error("CRITICAL: Missing env var SUPABASE_SERVICE_ROLE_KEY.");
  // Allow dev to run but fail in prod if needed
}

const inviteSchema = z.object({
  email: z.string().email("Invalid email address."),
  full_name: z.string().min(1, "Full name is required."),
  role: z.enum(["Worker", "Owner"], {
    required_error: "Role must be 'Worker' or 'Owner'.",
  }),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient(); // uses user session from cookies
  const supabaseAdmin = supabaseServiceRoleKey
    ? createAdminClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  try {
    // 1. Get logged-in user
    const {
      data: { user: inviterUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !inviterUser) {
      console.warn("Unauthorized invite attempt.", authError?.message);
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to invite users." },
        { status: 401 }
      );
    }

    // 2. Validate body
    let inviteData;
    try {
      const json = await request.json();
      inviteData = inviteSchema.parse(json);
    } catch (err) {
      const msg =
        err instanceof z.ZodError
          ? err.errors[0]?.message
          : "Invalid request body.";
      return NextResponse.json(
        { error: `Bad Request: ${msg}` },
        { status: 400 }
      );
    }

    // 3. Get inviter profile
    const { data: inviterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", inviterUser.id)
      .single();

    if (profileError || !inviterProfile) {
      console.error("Profile fetch failed:", profileError?.message);
      return NextResponse.json(
        { error: "Could not verify your profile." },
        { status: 500 }
      );
    }

    if (!inviterProfile.organization_id) {
      return NextResponse.json(
        {
          error:
            "Forbidden: You must belong to an organization to invite others.",
        },
        { status: 403 }
      );
    }

    if (inviterProfile.role === "Worker") {
      // Check if worker has permission to invite members
      const { data: hasPermission, error: permissionError } =
        await supabase.rpc("worker_has_permission", {
          permission_key: "team.invite",
        });

      if (permissionError) {
        console.error("Error checking permissions:", permissionError);
        return NextResponse.json(
          { error: "Failed to verify permissions" },
          { status: 500 }
        );
      }

      if (!hasPermission) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You don't have permission to invite team members",
          },
          { status: 403 }
        );
      }
    } else if (inviterProfile.role !== "Owner") {
      return NextResponse.json(
        {
          error: "Forbidden: You don't have permission to invite team members",
        },
        { status: 403 }
      );
    }

    // 3.5. Check plan limits before sending invite
    const limitCheck = await canAddUser(
      inviterProfile.organization_id,
      inviterUser.id
    );
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 402 } // Payment Required - plan limit exceeded
      );
    }

    // 4. Send Invite
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "Server configuration issue: SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const { data: inviteResponse, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(inviteData.email, {
        data: {
          role: inviteData.role,
          full_name: inviteData.full_name,
          organization_id: inviterProfile.organization_id,
          invited_by: inviterUser.id,
        },
      });

    if (inviteError) {
      console.error(
        `Invite error for ${inviteData.email}:`,
        inviteError.message
      );

      let msg = "Could not send invitation. Please try again.";
      if (
        inviteError.message.includes("already registered") ||
        inviteError.message.includes("already exists")
      ) {
        msg = "This email address is already registered or invited.";
        return NextResponse.json({ error: msg }, { status: 409 });
      }

      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json(
      { message: `Invitation sent to ${inviteData.email}.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected internal error occurred." },
      { status: 500 }
    );
  }
}
