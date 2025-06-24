import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CompositeItemStatusResponse } from "@/types/composite-items";

// GET /api/composite-items/status - Get composite item status/progress for organization
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
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
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const order_id = searchParams.get("order_id");
    const status_filter = searchParams.get("status"); // 'Not Started', 'In Progress', 'Completed'
    const search = searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("composite_item_status")
      .select("*")
      .eq("organization_id", profile.organization_id);

    // Apply filters
    if (order_id) {
      query = query.eq("order_id", order_id);
    }

    if (
      status_filter &&
      ["Not Started", "In Progress", "Completed"].includes(status_filter)
    ) {
      query = query.eq("composite_status", status_filter);
    }

    if (search) {
      query = query.or(
        `parent_composite_sku.ilike.%${search}%,order_number.ilike.%${search}%,customer_name.ilike.%${search}%`
      );
    }

    // Apply pagination and ordering
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: compositeStatuses, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching composite item statuses:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch composite item statuses" },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("composite_item_status")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id);

    if (order_id) {
      countQuery = countQuery.eq("order_id", order_id);
    }

    if (
      status_filter &&
      ["Not Started", "In Progress", "Completed"].includes(status_filter)
    ) {
      countQuery = countQuery.eq("composite_status", status_filter);
    }

    if (search) {
      countQuery = countQuery.or(
        `parent_composite_sku.ilike.%${search}%,order_number.ilike.%${search}%,customer_name.ilike.%${search}%`
      );
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error("Error counting composite item statuses:", countError);
      return NextResponse.json(
        { error: "Failed to count composite item statuses" },
        { status: 500 }
      );
    }

    const response: CompositeItemStatusResponse = {
      composite_statuses: compositeStatuses || [],
      total_count: totalCount || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/composite-items/status:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
