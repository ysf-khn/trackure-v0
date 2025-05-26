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

    // Get URL parameters for date range
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days") || "90";
    const days = parseInt(daysParam);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query movement history for the date range
    const { data: movementData, error: movementError } = await supabase
      .from("item_movement_history")
      .select("moved_at, rework_reason, quantity")
      .eq("organization_id", organizationId)
      .gte("moved_at", startDate.toISOString())
      .lte("moved_at", endDate.toISOString())
      .order("moved_at", { ascending: true });

    if (movementError) {
      console.error("Error fetching movement data:", movementError);
      return NextResponse.json(
        { error: "Failed to fetch movement data" },
        { status: 500 }
      );
    }

    // Group movements by date and type
    const dailyStats: Record<string, { forward: number; rework: number }> = {};

    // Initialize all dates in range with zero values
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateKey = d.toISOString().split("T")[0];
      dailyStats[dateKey] = { forward: 0, rework: 0 };
    }

    // Process movement data
    movementData?.forEach((movement) => {
      const dateKey = movement.moved_at.split("T")[0];
      const isRework =
        movement.rework_reason !== null && movement.rework_reason !== "";

      if (dailyStats[dateKey]) {
        if (isRework) {
          dailyStats[dateKey].rework += movement.quantity;
        } else {
          dailyStats[dateKey].forward += movement.quantity;
        }
      }
    });

    // Convert to array format for the chart
    const chartData = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      forward: stats.forward,
      rework: stats.rework,
    }));

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Error in movement stats API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
