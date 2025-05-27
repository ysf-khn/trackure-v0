import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const supabase = await createClient();

  try {
    // 1. Verify Authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get the requesting user's profile
    const { data: requesterProfile, error: requesterError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (requesterError || !requesterProfile) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // 3. Check if the requester is an Owner
    if (requesterProfile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Only Owners can remove team members" },
        { status: 403 }
      );
    }

    const memberId = (await params).memberId;

    // 4. Get the target member's profile
    const { data: targetMember, error: targetError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // 5. Verify both users are in the same organization
    if (targetMember.organization_id !== requesterProfile.organization_id) {
      return NextResponse.json(
        { error: "Forbidden: Member is not in your organization" },
        { status: 403 }
      );
    }

    // 6. Prevent self-removal
    if (memberId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the organization" },
        { status: 400 }
      );
    }

    // 7. Remove the member by setting their organization_id to null
    const { error: removeError } = await supabase
      .from("profiles")
      .update({
        organization_id: null,
        role: null,
      })
      .eq("id", memberId);

    if (removeError) {
      console.error("Error removing member:", removeError);
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
