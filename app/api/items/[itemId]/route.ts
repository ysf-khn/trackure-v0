import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const supabase = await createClient();

  try {
    // Get user and organization
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    const organizationId = profile.organization_id;

    // Fetch comprehensive item data
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select(
        `
        id,
        sku,
        buyer_id,
        total_quantity,
        remaining_quantity,
        status,
        instance_details,
        created_at,
        updated_at,
        order_id,
        orders!inner (
          id,
          order_number,
          customer_name,
          created_at
        )
      `
      )
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Fetch stage allocations with stage and sub-stage details
    const { data: allocations, error: allocationsError } = await supabase
      .from("item_stage_allocations")
      .select(
        `
        id,
        quantity,
        status,
        created_at,
        updated_at,
        stage_id,
        sub_stage_id,
        workflow_stages!inner (
          id,
          name,
          sequence_order,
          location
        ),
        workflow_sub_stages (
          id,
          name,
          sequence_order,
          location
        )
      `
      )
      .eq("item_id", itemId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (allocationsError) {
      console.error("Error fetching allocations:", allocationsError);
      return NextResponse.json(
        { error: "Failed to fetch stage allocations" },
        { status: 500 }
      );
    }

    // Fetch movement history
    const { data: historyData, error: historyError } = await supabase
      .from("item_movement_history")
      .select(
        `
        id,
        moved_at,
        quantity,
        rework_reason,
        from_stage_id,
        from_sub_stage_id,
        to_stage_id,
        to_sub_stage_id,
        moved_by,
        from_stage:workflow_stages!from_stage_id (
          name
        ),
        from_sub_stage:workflow_sub_stages!from_sub_stage_id (
          name
        ),
        to_stage:workflow_stages!to_stage_id (
          name
        ),
        to_sub_stage:workflow_sub_stages!to_sub_stage_id (
          name
        )
      `
      )
      .eq("item_id", itemId)
      .eq("organization_id", organizationId)
      .order("moved_at", { ascending: false });

    if (historyError) {
      console.error("Error fetching history:", historyError);
      return NextResponse.json(
        { error: "Failed to fetch movement history" },
        { status: 500 }
      );
    }

    // Fetch remarks count
    const { count: remarksCount, error: remarksCountError } = await supabase
      .from("item_remarks")
      .select("*", { count: "exact", head: true })
      .eq("item_id", itemId);

    if (remarksCountError) {
      console.error("Error fetching remarks count:", remarksCountError);
    }

    // Fetch images count
    const { count: imagesCount, error: imagesCountError } = await supabase
      .from("item_images")
      .select("*", { count: "exact", head: true })
      .eq("item_id", itemId);

    if (imagesCountError) {
      console.error("Error fetching images count:", imagesCountError);
    }

    // Process stage allocations
    const processedAllocations =
      allocations?.map((allocation) => ({
        id: allocation.id,
        quantity: allocation.quantity,
        status: allocation.status,
        created_at: allocation.created_at,
        updated_at: allocation.updated_at,
        stage: {
          id: allocation.stage_id,
          name: (allocation.workflow_stages as any)?.name || "Unknown Stage",
          sequence_order:
            (allocation.workflow_stages as any)?.sequence_order || 0,
          location: (allocation.workflow_stages as any)?.location || null,
        },
        sub_stage: allocation.workflow_sub_stages
          ? {
              id: allocation.sub_stage_id,
              name:
                (allocation.workflow_sub_stages as any)?.name ||
                "Unknown Sub-Stage",
              sequence_order:
                (allocation.workflow_sub_stages as any)?.sequence_order || 0,
              location:
                (allocation.workflow_sub_stages as any)?.location || null,
            }
          : null,
      })) || [];

    // Fetch user names separately for the movement history
    let userNames: Record<string, string> = {};
    if (historyData && historyData.length > 0) {
      const userIds = historyData
        .map((entry) => entry.moved_by)
        .filter((id): id is string => id !== null);

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (profilesData) {
          userNames = profilesData.reduce(
            (acc, profile) => {
              acc[profile.id] = profile.full_name;
              return acc;
            },
            {} as Record<string, string>
          );
        }
      }
    }

    // Process movement history
    const processedHistory =
      historyData?.map((entry) => ({
        id: entry.id,
        moved_at: entry.moved_at,
        quantity: entry.quantity,
        rework_reason: entry.rework_reason,
        from_stage_name: (entry.from_stage as any)?.name || null,
        from_sub_stage_name: (entry.from_sub_stage as any)?.name || null,
        to_stage_name: (entry.to_stage as any)?.name || null,
        to_sub_stage_name: (entry.to_sub_stage as any)?.name || null,
        moved_by_name: entry.moved_by
          ? userNames[entry.moved_by] || null
          : null,
      })) || [];

    // Calculate summary statistics
    const totalQuantityInWorkflow = processedAllocations.reduce(
      (sum, allocation) => sum + allocation.quantity,
      0
    );

    const quantityInNewPool = itemData.total_quantity - totalQuantityInWorkflow;
    const completedQuantity =
      itemData.total_quantity - itemData.remaining_quantity;

    // Group allocations by stage for easier display
    const allocationsByStage = processedAllocations.reduce(
      (acc, allocation) => {
        const stageKey = allocation.stage.id;
        if (!acc[stageKey]) {
          acc[stageKey] = {
            stage: allocation.stage,
            allocations: [],
            totalQuantity: 0,
          };
        }
        acc[stageKey].allocations.push(allocation);
        acc[stageKey].totalQuantity += allocation.quantity;
        return acc;
      },
      {} as Record<string, any>
    );

    const response = {
      item: {
        id: itemData.id,
        sku: itemData.sku,
        buyer_id: itemData.buyer_id,
        total_quantity: itemData.total_quantity,
        remaining_quantity: itemData.remaining_quantity,
        status: itemData.status,
        instance_details: itemData.instance_details,
        created_at: itemData.created_at,
        updated_at: itemData.updated_at,
        order: {
          id: itemData.order_id,
          order_number: (itemData.orders as any)?.order_number || null,
          customer_name: (itemData.orders as any)?.customer_name || null,
          created_at: (itemData.orders as any)?.created_at || null,
        },
      },
      allocations: processedAllocations,
      allocationsByStage: Object.values(allocationsByStage),
      history: processedHistory,
      summary: {
        total_quantity: itemData.total_quantity,
        quantity_in_workflow: totalQuantityInWorkflow,
        quantity_in_new_pool: quantityInNewPool,
        completed_quantity: completedQuantity,
        remarks_count: remarksCount || 0,
        images_count: imagesCount || 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching item details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
