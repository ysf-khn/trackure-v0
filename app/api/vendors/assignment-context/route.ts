import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const vendorId = searchParams.get("vendor_id");
  const sku = searchParams.get("sku");
  const stageId = searchParams.get("stage_id");
  const orderId = searchParams.get("order_id");

  if (!vendorId || !sku || !stageId) {
    return NextResponse.json(
      { error: "vendor_id, sku, and stage_id are required" },
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
    // Get order context and SKU details
    let orderContext = null;
    if (orderId) {
      console.log("Fetching order context for orderId:", orderId, "sku:", sku);
      
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

      if (orderData) {
        // Get total quantity for this SKU in this order
        const skuItems = orderData.items.filter((item: any) => item.sku === sku);
        const totalQuantity = skuItems.reduce(
          (sum: number, item: any) => sum + (item.working_quantity || item.total_quantity),
          0
        );

        console.log("SKU items:", skuItems, "Total quantity:", totalQuantity);

        orderContext = {
          order_id: orderData.id,
          order_number: orderData.order_number,
          customer_name: orderData.customer_name,
          total_quantity_for_sku: totalQuantity,
        };
      }
    } else {
      console.log("No orderId provided");
    }

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

    // Get vendor details with outstanding payments
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("id, name, firm_name")
      .eq("id", vendorId)
      .single();

    // Get outstanding payments for this vendor
    const { data: outstandingData } = await supabase.rpc(
      "get_vendor_outstanding_payments",
      {
        p_vendor_id: vendorId,
        p_organization_id: profile.organization_id,
      }
    );

    // Get price history for this vendor, SKU, and stage (last 5 entries)
    const { data: priceHistory } = await supabase
      .from("vendor_price_history")
      .select(`
        price,
        currency,
        price_unit,
        effective_from,
        notes
      `)
      .eq("vendor_id", vendorId)
      .eq("sku", sku)
      .eq("stage_id", stageId)
      .order("effective_from", { ascending: false })
      .limit(5);

    // Also get current pricing if exists
    const { data: currentPricing } = await supabase
      .from("vendor_stage_pricing")
      .select(`
        price,
        currency,
        price_unit,
        notes
      `)
      .eq("vendor_id", vendorId)
      .eq("sku", sku)
      .eq("stage_id", stageId)
      .eq("is_active", true)
      .single();

    // Get recent payment records with remarks (last 5)
    const { data: recentPayments } = await supabase
      .from("vendor_payments")
      .select(`
        payment_type,
        amount_paid,
        remarks,
        payment_date,
        vendor_orders!vendor_payments_vendor_order_id_fkey(
          sku,
          order_number
        )
      `)
      .eq("vendor_id", vendorId)
      .order("payment_date", { ascending: false })
      .limit(5);

    // Format the response
    const response = {
      order_context: orderContext
        ? {
            ...orderContext,
            sku: sku,
            sku_name: skuData?.master_details?.name || sku,
            stage_name: stageData?.name || "",
            stage_path: stageData?.full_path || "",
          }
        : {
            sku: sku,
            sku_name: skuData?.master_details?.name || sku,
            stage_name: stageData?.name || "",
            stage_path: stageData?.full_path || "",
            total_quantity_for_sku: 0,
          },
      vendor_info: {
        vendor_id: vendorData?.id,
        vendor_name: vendorData?.name,
        vendor_firm: vendorData?.firm_name,
        outstanding_amount: outstandingData?.[0]?.total_outstanding || 0,
        outstanding_orders: outstandingData?.[0]?.outstanding_orders || [],
        current_pricing: currentPricing
          ? {
              price: currentPricing.price,
              currency: currentPricing.currency,
              price_unit: currentPricing.price_unit,
              notes: currentPricing.notes,
            }
          : null,
        price_history: priceHistory?.map((p) => ({
          date: new Date(p.effective_from).toLocaleDateString(),
          price: p.price,
          currency: p.currency,
          price_unit: p.price_unit,
          notes: p.notes || "",
        })) || [],
        recent_payments: recentPayments?.map((p) => {
          // Handle vendor_orders that might be an array or single object
          const vendorOrder = Array.isArray(p.vendor_orders) 
            ? p.vendor_orders[0] 
            : p.vendor_orders;
          
          return {
            type: p.payment_type,
            amount: p.amount_paid,
            remarks: p.remarks || "",
            date: new Date(p.payment_date).toLocaleDateString(),
            sku: vendorOrder?.sku,
            order_number: vendorOrder?.order_number,
          };
        }) || [],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching vendor assignment context:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor assignment context" },
      { status: 500 }
    );
  }
}