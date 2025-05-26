import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export interface BottleneckItem {
  item_id: string;
  sku: string;
  order_number: string;
  current_stage_name: string;
  current_sub_stage_name: string | null;
  time_in_current_stage: string; // Human-readable duration
  stage_entry_time: string; // ISO timestamp
  quantity: number;
}

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

    // Get the "Completed" stage ID for this organization to exclude completed items
    const { data: completedStage } = await supabase
      .from("workflow_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", "Completed")
      .single();

    const completedStageId = completedStage?.id;

    // Get URL parameters for limit
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit") || "10";
    const limit = Math.min(parseInt(limitParam), 50); // Cap at 50 items

    // Query to get items waiting longest in their current stage
    // This query finds the most recent movement history entry for each item allocation
    // and calculates how long they've been in their current stage
    const { data: bottleneckItems, error: bottleneckError } =
      await supabase.rpc("get_bottleneck_items", {
        org_id: organizationId,
        completed_stage_id: completedStageId,
        item_limit: limit,
      });

    if (bottleneckError) {
      console.error("Error fetching bottleneck items:", bottleneckError);

      // If the function doesn't exist, fall back to a direct query
      // This is a more complex query that we'll implement as a fallback
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("item_stage_allocations")
        .select(
          `
          quantity,
          items!inner (
            id,
            sku,
            orders!inner (
              order_number
            )
          ),
          workflow_stages!inner (
            name
          ),
          workflow_sub_stages (
            name
          ),
          created_at
        `
        )
        .eq("organization_id", organizationId)
        .neq(
          "stage_id",
          completedStageId || "00000000-0000-0000-0000-000000000000"
        )
        .order("created_at", { ascending: true })
        .limit(limit);

      if (fallbackError) {
        console.error("Error with fallback query:", fallbackError);
        return NextResponse.json(
          { error: "Failed to fetch bottleneck items" },
          { status: 500 }
        );
      }

      // Process fallback data to match expected format
      const processedFallbackData =
        fallbackData?.map((allocation: any) => {
          const item = Array.isArray(allocation.items)
            ? allocation.items[0]
            : allocation.items;
          const order = Array.isArray(item.orders)
            ? item.orders[0]
            : item.orders;
          const stage = Array.isArray(allocation.workflow_stages)
            ? allocation.workflow_stages[0]
            : allocation.workflow_stages;
          const subStage = Array.isArray(allocation.workflow_sub_stages)
            ? allocation.workflow_sub_stages[0]
            : allocation.workflow_sub_stages;

          const stageEntryTime = new Date(allocation.created_at);
          const now = new Date();
          const diffMs = now.getTime() - stageEntryTime.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor(
            (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
          );

          let timeInStage = "";
          if (diffDays > 0) {
            timeInStage = diffDays === 1 ? "1 day" : `${diffDays} days`;
            if (diffHours > 0) {
              timeInStage += `, ${diffHours}h`;
            }
          } else if (diffHours > 0) {
            timeInStage = diffHours === 1 ? "1 hour" : `${diffHours} hours`;
          } else {
            timeInStage = "< 1 hour";
          }

          return {
            item_id: item.id,
            sku: item.sku,
            order_number: order.order_number,
            current_stage_name: stage.name,
            current_sub_stage_name: subStage?.name || null,
            time_in_current_stage: timeInStage,
            stage_entry_time: allocation.created_at,
            quantity: allocation.quantity,
          };
        }) || [];

      return NextResponse.json(processedFallbackData);
    }

    return NextResponse.json(bottleneckItems || []);
  } catch (error) {
    console.error("Bottleneck items API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
