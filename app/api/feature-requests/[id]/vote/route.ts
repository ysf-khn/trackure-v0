import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const featureRequestId = params.id;

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: "User organization not found" },
        { status: 400 }
      );
    }

    // Verify the feature request exists and belongs to the user's organization
    const { data: featureRequest, error: frError } = await supabase
      .from("feature_requests")
      .select("id, organization_id")
      .eq("id", featureRequestId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (frError || !featureRequest) {
      return NextResponse.json(
        { error: "Feature request not found" },
        { status: 404 }
      );
    }

    // Check if user has already voted
    const { data: existingVote, error: voteCheckError } = await supabase
      .from("feature_request_votes")
      .select("id")
      .eq("feature_request_id", featureRequestId)
      .eq("user_id", user.id)
      .single();

    if (voteCheckError && voteCheckError.code !== "PGRST116") {
      console.error("Error checking existing vote:", voteCheckError);
      return NextResponse.json(
        { error: "Failed to check existing vote" },
        { status: 500 }
      );
    }

    if (existingVote) {
      return NextResponse.json(
        { error: "You have already voted on this feature request" },
        { status: 400 }
      );
    }

    // Create the vote
    const { data: vote, error: voteError } = await supabase
      .from("feature_request_votes")
      .insert({
        feature_request_id: featureRequestId,
        user_id: user.id,
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (voteError) {
      console.error("Error creating vote:", voteError);
      return NextResponse.json(
        { error: "Failed to create vote" },
        { status: 500 }
      );
    }

    // Get updated feature request with new vote count
    const { data: updatedFeatureRequest, error: updateError } = await supabase
      .from("feature_requests")
      .select("vote_count")
      .eq("id", featureRequestId)
      .single();

    if (updateError) {
      console.error("Error fetching updated feature request:", updateError);
      return NextResponse.json(
        { error: "Failed to fetch updated vote count" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        vote_id: vote.id,
        vote_count: updatedFeatureRequest.vote_count,
        user_has_voted: true,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const featureRequestId = params.id;

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: "User organization not found" },
        { status: 400 }
      );
    }

    // Verify the feature request exists and belongs to the user's organization
    const { data: featureRequest, error: frError } = await supabase
      .from("feature_requests")
      .select("id, organization_id")
      .eq("id", featureRequestId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (frError || !featureRequest) {
      return NextResponse.json(
        { error: "Feature request not found" },
        { status: 404 }
      );
    }

    // Delete the user's vote
    const { error: deleteError } = await supabase
      .from("feature_request_votes")
      .delete()
      .eq("feature_request_id", featureRequestId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting vote:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete vote" },
        { status: 500 }
      );
    }

    // Get updated feature request with new vote count
    const { data: updatedFeatureRequest, error: updateError } = await supabase
      .from("feature_requests")
      .select("vote_count")
      .eq("id", featureRequestId)
      .single();

    if (updateError) {
      console.error("Error fetching updated feature request:", updateError);
      return NextResponse.json(
        { error: "Failed to fetch updated vote count" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        vote_count: updatedFeatureRequest.vote_count,
        user_has_voted: false,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
