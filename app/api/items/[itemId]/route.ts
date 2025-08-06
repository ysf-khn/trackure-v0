import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

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
        composite_group_id,
        parent_composite_sku,
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

    // Fetch parent composite details if this item is a component
    let parentCompositeDetails = null;
    if (itemData.parent_composite_sku && itemData.composite_group_id) {
      const { data: parentData, error: parentError } = await supabase
        .from("items")
        .select(
          `
          id,
          sku,
          instance_details,
          created_at,
          updated_at,
          total_quantity,
          remaining_quantity,
          status
        `
        )
        .eq("organization_id", organizationId)
        .eq("composite_group_id", itemData.composite_group_id)
        .eq("sku", itemData.parent_composite_sku)
        .limit(1)
        .maybeSingle();

      if (parentError) {
        console.error("Error fetching parent composite details:", parentError);
      } else if (parentData) {
        parentCompositeDetails = {
          sku: parentData.sku,
          instance_details: parentData.instance_details,
          created_at: parentData.created_at,
          updated_at: parentData.updated_at,
          total_quantity: parentData.total_quantity,
          remaining_quantity: parentData.remaining_quantity,
          status: parentData.status,
        };
      }
    }

    // Fetch stage allocations with stage details
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
        workflow_stages!inner (
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
        to_stage_id,
        moved_by,
        from_stage:workflow_stages!from_stage_id (
          name
        ),
        to_stage:workflow_stages!to_stage_id (
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
        to_stage_name: (entry.to_stage as any)?.name || null,
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
        composite_group_id: itemData.composite_group_id,
        parent_composite_sku: itemData.parent_composite_sku,
        order: {
          id: itemData.order_id,
          order_number: (itemData.orders as any)?.order_number || null,
          customer_name: (itemData.orders as any)?.customer_name || null,
          created_at: (itemData.orders as any)?.created_at || null,
        },
      },
      parentComposite: parentCompositeDetails,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const supabase = await createClient();

  try {
    // Get user and profile
    const {
      user,
      profile,
      error: userProfileError,
    } = await getUserWithProfile(supabase);

    if (userProfileError || !user || !profile?.organization_id) {
      return NextResponse.json(
        { error: userProfileError?.message || "Unauthorized" },
        { status: 401 }
      );
    }

    const organizationId = profile.organization_id;

    // RBAC Check: Check permission for workers
    if (profile.role === "Worker") {
      // Check if worker has permission to delete items
      const { data: hasPermission, error: permissionError } =
        await supabase.rpc("worker_has_permission", {
          permission_key: "items.delete",
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
          { error: "Forbidden: You don't have permission to delete items" },
          { status: 403 }
        );
      }
    } else if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      );
    }

    // Check if item exists and belongs to the organization
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id, sku, total_quantity")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json(
        { error: "Item not found or access denied" },
        { status: 404 }
      );
    }

    // Check if item has any stage allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from("item_stage_allocations")
      .select("id")
      .eq("item_id", itemId)
      .eq("organization_id", organizationId);

    if (allocationsError) {
      console.error("Error checking allocations:", allocationsError);
      return NextResponse.json(
        { error: "Failed to check item allocations" },
        { status: 500 }
      );
    }

    if (allocations && allocations.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete item: It has active allocations in the workflow. Please move all quantities out of the workflow before deleting.`,
        },
        { status: 409 }
      );
    }

    // Delete related records first (due to foreign key constraints)
    // Delete item images
    const { error: imagesDeleteError } = await supabase
      .from("item_images")
      .delete()
      .eq("item_id", itemId);

    if (imagesDeleteError) {
      console.error("Error deleting item images:", imagesDeleteError);
      return NextResponse.json(
        { error: "Failed to delete item images" },
        { status: 500 }
      );
    }

    // Delete item remarks
    const { error: remarksDeleteError } = await supabase
      .from("item_remarks")
      .delete()
      .eq("item_id", itemId);

    if (remarksDeleteError) {
      console.error("Error deleting item remarks:", remarksDeleteError);
      return NextResponse.json(
        { error: "Failed to delete item remarks" },
        { status: 500 }
      );
    }

    // Delete movement history
    const { error: historyDeleteError } = await supabase
      .from("item_movement_history")
      .delete()
      .eq("item_id", itemId);

    if (historyDeleteError) {
      console.error("Error deleting movement history:", historyDeleteError);
      return NextResponse.json(
        { error: "Failed to delete movement history" },
        { status: 500 }
      );
    }

    // Finally, delete the item itself
    const { error: itemDeleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", itemId)
      .eq("organization_id", organizationId);

    if (itemDeleteError) {
      console.error("Error deleting item:", itemDeleteError);
      return NextResponse.json(
        { error: "Failed to delete item" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Item deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
