import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { sku, order_id } = await request.json();
    
    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 });
    }

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

    // Call the cost estimation function
    if (order_id) {
      // Get cost estimation for specific SKU-Order combination
      const { data: costEstimation, error: costError } = await supabase.rpc(
        'calculate_sku_order_workflow_cost',
        {
          p_sku: sku,
          p_order_id: order_id,
          p_organization_id: profile.organization_id
        }
      );

      if (costError) {
        console.error("Error calculating SKU-Order cost:", costError);
        return NextResponse.json({ error: "Failed to calculate cost estimation" }, { status: 500 });
      }

      return NextResponse.json({
        cost_estimation: costEstimation,
        type: 'sku_order'
      });
    } else {
      // Get general SKU cost information
      const { data: skuInfo, error: skuError } = await supabase
        .from("sku_management_view")
        .select(`
          sku,
          final_calculated_cost,
          base_material_cost,
          total_workflow_cost,
          estimated_workflow_cost,
          workflow_stages_count,
          vendors_count,
          min_vendor_price,
          avg_vendor_price,
          max_vendor_price,
          currency
        `)
        .eq("sku", sku)
        .eq("organization_id", profile.organization_id)
        .limit(1)
        .single();

      if (skuError) {
        console.error("Error fetching SKU cost info:", skuError);
        return NextResponse.json({ error: "Failed to fetch SKU cost information" }, { status: 500 });
      }

      // Get workflow stages with vendor pricing details
      const { data: stageDetails, error: stageError } = await supabase
        .from("workflow_stages")
        .select(`
          id,
          name,
          sequence_order,
          is_leaf_stage,
          vendor_stage_pricing!inner(
            vendor_id,
            price,
            currency,
            lead_time_days,
            vendors(
              id,
              name,
              firm_name
            )
          )
        `)
        .eq("sku", sku)
        .eq("organization_id", profile.organization_id)
        .eq("vendor_stage_pricing.is_active", true)
        .order("sequence_order");

      if (stageError) {
        console.error("Error fetching stage details:", stageError);
        return NextResponse.json({ error: "Failed to fetch workflow stage details" }, { status: 500 });
      }

      return NextResponse.json({
        sku_info: skuInfo,
        stage_details: stageDetails || [],
        type: 'sku_general'
      });
    }

  } catch (error) {
    console.error("Error in cost estimation API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}