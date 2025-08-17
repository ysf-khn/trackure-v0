import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const sku = searchParams.get("sku");
  const stageId = searchParams.get("stage_id");
  const orderId = searchParams.get("order_id");

  if (!sku || !stageId || !orderId) {
    return NextResponse.json(
      { error: "sku, stage_id, and order_id are required" },
      { status: 400 }
    );
  }

  // Get the authenticated user
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
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 }
    );
  }

  try {
    console.log("Fetching order context for orderId:", orderId, "sku:", sku);
    
    // Get order context and SKU details
    const { data: orderData } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        items!items_order_id_fkey(
          id,
          sku,
          total_quantity,
          working_quantity
        )
      `)
      .eq("id", orderId)
      .single();

    console.log("Order data:", orderData);

    if (!orderData) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Get total quantity for this SKU in this order
    const skuItems = orderData.items.filter((item: any) => item.sku === sku);
    const totalQuantity = skuItems.reduce(
      (sum: number, item: any) => sum + (item.working_quantity || item.total_quantity),
      0
    );

    console.log("SKU items:", skuItems, "Total quantity:", totalQuantity);

    // Get SKU details
    const { data: skuData } = await supabase
      .from("item_master")
      .select("sku, master_details")
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .single();

    // Get stage details
    const { data: stageData } = await supabase
      .from("workflow_stages")
      .select("name, full_path")
      .eq("id", stageId)
      .single();

    // Format the response
    const response = {
      order_id: orderData.id,
      order_number: orderData.order_number,
      customer_name: orderData.customer_name,
      total_quantity_for_sku: totalQuantity,
      sku: sku,
      sku_name: skuData?.master_details?.name || sku,
      stage_name: stageData?.name || "",
      stage_path: stageData?.full_path || "",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching order context:", error);
    return NextResponse.json(
      { error: "Failed to fetch order context" },
      { status: 500 }
    );
  }
}