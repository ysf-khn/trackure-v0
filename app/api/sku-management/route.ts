import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get SKU-Order combinations from the new management view
    const { data: skuOrders, error: skuOrdersError } = await supabase
      .from("sku_order_management_view")
      .select(`
        sku,
        sku_name,
        order_id,
        order_number,
        buyer_id,
        order_status,
        items_count_for_order,
        total_quantity_for_order,
        remaining_quantity_for_order,
        active_items_for_order,
        completed_items_for_order,
        active_template_id,
        active_template_name,
        template_description,
        has_active_template,
        workflow_stages_count,
        leaf_stages_count,
        vendors_count,
        min_vendor_price,
        avg_vendor_price,
        max_vendor_price,
        final_calculated_cost,
        base_material_cost,
        total_workflow_cost,
        estimated_workflow_cost,
        samples_count,
        order_created_at,
        last_movement,
        template_usage_count,
        template_avg_days,
        parent_composite_sku,
        is_component_item,
        sku_order_status,
        currency,
        last_calculated_at
      `)
      .eq("organization_id", profile.organization_id)
      .order("order_created_at", { ascending: false });

    if (skuOrdersError) {
      console.error("Error fetching SKU-Order combinations:", skuOrdersError);
      return NextResponse.json({ error: "Failed to fetch SKU-Order data" }, { status: 500 });
    }

    // Calculate aggregate stats from the SKU-Order data
    const uniqueSKUs = new Set();
    const uniqueOrders = new Set();
    const uniqueVendors = new Set();
    let totalActiveItems = 0;
    let totalCosts = 0;
    let costsCount = 0;

    skuOrders?.forEach(record => {
      uniqueSKUs.add(record.sku);
      uniqueOrders.add(record.order_id);
      totalActiveItems += record.active_items_for_order || 0;
      
      if (record.final_calculated_cost) {
        totalCosts += record.final_calculated_cost;
        costsCount++;
      }
      
      // Count unique vendors across all SKU-Order combinations
      if (record.vendors_count > 0) {
        uniqueVendors.add(`${record.sku}-vendors`); // Approximation
      }
    });

    const stats = {
      total_sku_order_combinations: skuOrders?.length || 0,
      unique_skus: uniqueSKUs.size,
      unique_orders: uniqueOrders.size,
      active_sku_order_combinations: skuOrders?.filter(r => r.active_items_for_order > 0).length || 0,
      avg_cost: costsCount > 0 ? totalCosts / costsCount : 0,
      total_active_items: totalActiveItems,
      total_estimated_workflow_cost: skuOrders?.reduce((sum, r) => sum + (r.estimated_workflow_cost || 0), 0) || 0,
      // Keep legacy fields for backward compatibility
      total_skus: uniqueSKUs.size,
      active_skus: skuOrders?.filter(r => r.active_items_for_order > 0).length || 0,
      total_vendors: uniqueVendors.size,
    };

    return NextResponse.json({
      sku_orders: skuOrders || [],
      stats,
      // Keep legacy field for backward compatibility
      skus: skuOrders || [],
    });

  } catch (error) {
    console.error("Error in SKU management API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}