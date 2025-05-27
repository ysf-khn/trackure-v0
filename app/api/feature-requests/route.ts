import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Get query parameters
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const sortBy = searchParams.get("sortBy") || "vote_count";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build the query
    let query = supabase
      .from("feature_requests")
      .select(
        `
        *,
        submitted_by_profile:profiles!feature_requests_submitted_by_fkey(
          full_name
        ),
        user_vote:feature_request_votes!inner(
          id
        )
      `
      )
      .range(offset, offset + limit - 1);

    // Apply filters
    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply sorting
    const validSortColumns = [
      "vote_count",
      "created_at",
      "updated_at",
      "title",
    ];
    const validSortOrders = ["asc", "desc"];

    if (
      validSortColumns.includes(sortBy) &&
      validSortOrders.includes(sortOrder)
    ) {
      query = query.order(sortBy, { ascending: sortOrder === "asc" });
    }

    // Execute the query
    const { data: featureRequests, error } = await query;

    if (error) {
      console.error("Error fetching feature requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch feature requests" },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("feature_requests")
      .select("*", { count: "exact", head: true });

    if (category && category !== "all") {
      countQuery = countQuery.eq("category", category);
    }
    if (status && status !== "all") {
      countQuery = countQuery.eq("status", status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Error counting feature requests:", countError);
      return NextResponse.json(
        { error: "Failed to count feature requests" },
        { status: 500 }
      );
    }

    // Check which feature requests the current user has voted on
    const { data: userVotes, error: votesError } = await supabase
      .from("feature_request_votes")
      .select("feature_request_id")
      .eq("user_id", user.id);

    if (votesError) {
      console.error("Error fetching user votes:", votesError);
      return NextResponse.json(
        { error: "Failed to fetch user votes" },
        { status: 500 }
      );
    }

    const votedRequestIds = new Set(
      userVotes?.map((vote) => vote.feature_request_id) || []
    );

    // Add user vote status to each feature request
    const featureRequestsWithVotes = featureRequests?.map((request) => ({
      ...request,
      user_has_voted: votedRequestIds.has(request.id),
    }));

    return NextResponse.json({
      data: featureRequestsWithVotes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();

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

    // Parse request body
    const body = await request.json();
    const { title, description, category = "general" } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (title.length < 3 || title.length > 200) {
      return NextResponse.json(
        { error: "Title must be between 3 and 200 characters" },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 2000) {
      return NextResponse.json(
        { error: "Description must be between 10 and 2000 characters" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "general",
      "workflow",
      "reporting",
      "ui-ux",
      "integration",
      "performance",
      "mobile",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Create the feature request
    const { data: featureRequest, error } = await supabase
      .from("feature_requests")
      .insert({
        title: title.trim(),
        description: description.trim(),
        category,
        organization_id: profile.organization_id,
        submitted_by: user.id,
      })
      .select(
        `
        *,
        submitted_by_profile:profiles!feature_requests_submitted_by_fkey(
          full_name
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating feature request:", error);
      return NextResponse.json(
        { error: "Failed to create feature request" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: {
          ...featureRequest,
          user_has_voted: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
