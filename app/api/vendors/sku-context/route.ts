import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const sku = searchParams.get("sku");
  const stageId = searchParams.get("stage_id");

  if (!sku || !stageId) {
    return NextResponse.json(
      { error: "sku and stage_id are required" },
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
    // Get all active vendors for the organization
    const { data: vendors, error: vendorsError } = await supabase
      .from("vendors")
      .select(`
        id,
        name,
        firm_name,
        is_active,
        gst,
        phone,
        email
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name");

    if (vendorsError) {
      console.error("Error fetching vendors:", vendorsError);
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      );
    }

    // For each vendor, get their context for this SKU and stage
    const vendorsWithContext = await Promise.all(
      vendors.map(async (vendor) => {
        // Get price history for this vendor, SKU, and stage
        const { data: priceHistory } = await supabase
          .from("vendor_price_history")
          .select(`
            price,
            currency,
            price_unit,
            effective_from,
            notes
          `)
          .eq("vendor_id", vendor.id)
          .eq("sku", sku)
          .eq("stage_id", stageId)
          .order("effective_from", { ascending: false })
          .limit(3);

        // Get current active pricing if exists
        const { data: currentPricing } = await supabase
          .from("vendor_stage_pricing")
          .select(`
            price,
            currency,
            price_unit,
            notes,
            updated_at
          `)
          .eq("vendor_id", vendor.id)
          .eq("sku", sku)
          .eq("stage_id", stageId)
          .eq("is_active", true)
          .single();

        // Get recent payment history for this vendor
        const { data: recentPayments } = await supabase
          .from("vendor_payments")
          .select(`
            payment_type,
            amount_paid,
            remarks,
            payment_date,
            vendor_orders!vendor_payments_vendor_order_id_fkey(
              sku,
              order_number,
              stage_id
            )
          `)
          .eq("vendor_id", vendor.id)
          .order("payment_date", { ascending: false })
          .limit(3);

        // Filter payments for this SKU
        const skuPayments = recentPayments?.filter(payment => {
          // Handle vendor_orders that might be an array or single object
          const vendorOrder = Array.isArray(payment.vendor_orders) 
            ? payment.vendor_orders[0] 
            : payment.vendor_orders;
          return vendorOrder?.sku === sku;
        }) || [];

        // Get outstanding amount for this vendor
        const { data: outstandingData } = await supabase.rpc(
          "get_vendor_outstanding_payments",
          {
            p_vendor_id: vendor.id,
            p_organization_id: profile.organization_id,
          }
        );

        return {
          ...vendor,
          context: {
            price_history: priceHistory?.map(p => ({
              date: new Date(p.effective_from).toLocaleDateString(),
              price: p.price,
              currency: p.currency,
              price_unit: p.price_unit,
              notes: p.notes,
            })) || [],
            current_pricing: currentPricing ? {
              price: currentPricing.price,
              currency: currentPricing.currency,
              price_unit: currentPricing.price_unit,
              notes: currentPricing.notes,
              last_updated: new Date(currentPricing.updated_at).toLocaleDateString(),
            } : null,
            recent_payments: skuPayments.map(p => {
              // Handle vendor_orders that might be an array or single object
              const vendorOrder = Array.isArray(p.vendor_orders) 
                ? p.vendor_orders[0] 
                : p.vendor_orders;
              
              return {
                type: p.payment_type,
                amount: p.amount_paid,
                remarks: p.remarks,
                date: new Date(p.payment_date).toLocaleDateString(),
                order_number: vendorOrder?.order_number,
              };
            }),
            outstanding_amount: outstandingData?.[0]?.total_outstanding || 0,
            has_worked_before: ((priceHistory?.length || 0) > 0) || (currentPricing !== null),
            last_work_date: priceHistory?.[0]?.effective_from || currentPricing?.updated_at,
          }
        };
      })
    );

    // Sort vendors: those who have worked before first, then by name
    vendorsWithContext.sort((a, b) => {
      if (a.context.has_worked_before && !b.context.has_worked_before) return -1;
      if (!a.context.has_worked_before && b.context.has_worked_before) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      vendors: vendorsWithContext,
      meta: {
        total_count: vendorsWithContext.length,
        experienced_count: vendorsWithContext.filter(v => v.context.has_worked_before).length,
        sku: sku,
        stage_id: stageId,
      }
    });

  } catch (error) {
    console.error("Error fetching vendor SKU context:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor context" },
      { status: 500 }
    );
  }
}