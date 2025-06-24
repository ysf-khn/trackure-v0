import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const compositeGroupId = searchParams.get("composite_group_id");
  const parentCompositeSku = searchParams.get("parent_composite_sku");

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

    if (!compositeGroupId || !parentCompositeSku) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Fetch component items to derive parent composite details
    const { data: componentItems, error: componentError } = await supabase
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
      .eq("organization_id", profile.organization_id)
      .eq("composite_group_id", compositeGroupId)
      .eq("parent_composite_sku", parentCompositeSku);

    if (componentError) {
      console.error("Error fetching component items:", componentError);
      return NextResponse.json(
        { error: "Failed to fetch component items" },
        { status: 500 }
      );
    }

    if (!componentItems || componentItems.length === 0) {
      return NextResponse.json(
        { error: "No component items found for this composite group" },
        { status: 404 }
      );
    }

    // Get composite definition details
    const { data: compositeDefinition, error: definitionError } = await supabase
      .from("composite_item_definitions")
      .select("name, description")
      .eq("composite_sku", parentCompositeSku)
      .eq("organization_id", profile.organization_id)
      .single();

    if (definitionError) {
      console.error("Error fetching composite definition:", definitionError);
      // Continue without definition details
    }

    // Calculate derived parent composite details
    const totalQuantity = componentItems.reduce(
      (sum, item) => sum + item.total_quantity,
      0
    );
    const remainingQuantity = componentItems.reduce(
      (sum, item) => sum + item.remaining_quantity,
      0
    );
    const completedQuantity = totalQuantity - remainingQuantity;

    // Determine overall status
    let status: string;
    if (remainingQuantity === 0) {
      status = "Completed";
    } else if (completedQuantity === 0) {
      status = "New";
    } else {
      status = "In Progress";
    }

    // Use the first component's timestamps and instance details as representative
    const representativeItem = componentItems[0];

    return NextResponse.json({
      sku: parentCompositeSku,
      instance_details: representativeItem.instance_details || {},
      created_at: representativeItem.created_at,
      updated_at: componentItems.reduce(
        (latest, item) =>
          new Date(item.updated_at) > new Date(latest)
            ? item.updated_at
            : latest,
        representativeItem.updated_at
      ),
      total_quantity: totalQuantity,
      remaining_quantity: remainingQuantity,
      status: status,
      // Additional composite-specific fields
      component_count: componentItems.length,
      composite_name: compositeDefinition?.name || null,
      composite_description: compositeDefinition?.description || null,
    });
  } catch (error) {
    console.error("Error fetching parent composite details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
