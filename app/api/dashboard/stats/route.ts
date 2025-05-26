import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user and their organization
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

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const organizationId = profile.organization_id;

    // Get the "Completed" stage ID for this organization
    const { data: completedStage } = await supabase
      .from("workflow_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", "Completed")
      .single();

    const completedStageId = completedStage?.id;

    // 1. Active Items - items in workflow that haven't reached completed stage
    // Use a simpler approach: sum all quantities in item_stage_allocations excluding completed stage
    let activeItemsQuery = supabase
      .from("item_stage_allocations")
      .select("quantity")
      .eq("organization_id", organizationId);

    // Only exclude completed stage if it exists
    if (completedStageId) {
      activeItemsQuery = activeItemsQuery.neq("stage_id", completedStageId);
    }

    const { data: activeItemsData, error: activeItemsError } =
      await activeItemsQuery;

    if (activeItemsError) {
      console.error("Error fetching active items:", activeItemsError);
      return NextResponse.json(
        { error: "Failed to fetch active items" },
        { status: 500 }
      );
    }

    // Calculate total active items quantity
    const activeItemsCount =
      activeItemsData?.reduce((total, allocation) => {
        return total + allocation.quantity;
      }, 0) || 0;

    // 2. Active Orders - orders with items that haven't fully completed
    const { data: activeOrdersData, error: activeOrdersError } = await supabase
      .from("orders")
      .select(
        `
        id,
        items!inner(
          remaining_quantity
        )
      `
      )
      .eq("organization_id", organizationId)
      .gt("items.remaining_quantity", 0);

    if (activeOrdersError) {
      console.error("Error fetching active orders:", activeOrdersError);
      return NextResponse.json(
        { error: "Failed to fetch active orders" },
        { status: 500 }
      );
    }

    const activeOrdersCount = activeOrdersData?.length || 0;

    // 3. Items in Rework - items whose most recent movement has a rework_reason
    const { data: reworkItemsData, error: reworkItemsError } =
      await supabase.rpc("get_items_in_rework", {
        org_id: organizationId,
      });

    if (reworkItemsError) {
      console.error("Error fetching rework items:", reworkItemsError);
      return NextResponse.json(
        { error: "Failed to fetch rework items" },
        { status: 500 }
      );
    }

    const itemsInReworkCount = reworkItemsData || 0;

    // 4. Items Waiting > 7 Days - items not in final stage where current stage entry is > 7 days old
    const { data: waitingItemsData, error: waitingItemsError } =
      await supabase.rpc("get_items_waiting_over_7_days", {
        org_id: organizationId,
        completed_stage_id: completedStageId,
      });

    if (waitingItemsError) {
      console.error("Error fetching waiting items:", waitingItemsError);
      return NextResponse.json(
        { error: "Failed to fetch waiting items" },
        { status: 500 }
      );
    }

    const itemsWaitingOver7DaysCount = waitingItemsData || 0;

    return NextResponse.json({
      activeItems: activeItemsCount,
      activeOrders: activeOrdersCount,
      itemsInRework: itemsInReworkCount,
      itemsWaitingOver7Days: itemsWaitingOver7DaysCount,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
