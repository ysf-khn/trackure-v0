import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params;
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

    // Get comprehensive SKU data from the management view
    const { data: skuData, error: skuError } = await supabase
      .from("sku_management_view")
      .select(`
        sku,
        sku_name,
        sku_description,
        specifications,
        final_calculated_cost,
        base_material_cost,
        total_workflow_cost,
        markup_percentage,
        currency,
        cost_per_unit,
        last_calculated_at,
        active_items_count,
        total_active_quantity,
        completed_items_count,
        total_completed_quantity,
        workflow_stages_count,
        leaf_stages_count,
        vendors_count,
        min_vendor_price,
        avg_vendor_price,
        samples_count,
        last_item_created,
        last_movement,
        created_at
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .single();

    if (skuError) {
      console.error("Error fetching SKU:", skuError);
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    // Get supplementary data for modal tabs
    
    // Get basic items list
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id, total_quantity, remaining_quantity, status, created_at")
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
    }

    // Get workflow stages for this SKU
    const { data: workflowStages, error: stagesError } = await supabase
      .from("workflow_stages")
      .select(`
        id,
        name,
        sequence_order,
        parent_stage_id,
        depth_level,
        is_leaf_stage,
        location
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .order("sequence_order");

    if (stagesError) {
      console.error("Error fetching workflow stages:", stagesError);
    }

    // Get vendor pricing with vendor details
    const { data: vendorPricing, error: vendorError } = await supabase
      .from("vendor_stage_pricing")
      .select(`
        id,
        stage_id,
        vendor_id,
        price,
        currency,
        lead_time_days,
        is_active,
        vendors(
          id,
          name,
          firm_name
        ),
        workflow_stages(
          name
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true);

    if (vendorError) {
      console.error("Error fetching vendor pricing:", vendorError);
    }

    // Get samples
    const { data: samples, error: samplesError } = await supabase
      .from("samples")
      .select(`
        id,
        name,
        location,
        quantity,
        size,
        created_at
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id);

    if (samplesError) {
      console.error("Error fetching samples:", samplesError);
    }

    // Get recent movements
    const itemIds = items?.map(i => i.id) || [];
    const { data: recentMovements, error: movementsError } = itemIds.length > 0 
      ? await supabase
          .from("item_movement_history")
          .select(`
            id,
            quantity,
            moved_at,
            rework_reason,
            rework_type,
            from_stage_id,
            to_stage_id,
            moved_by,
            from_stage:workflow_stages!item_movement_history_from_stage_id_fkey(
              name
            ),
            to_stage:workflow_stages!item_movement_history_to_stage_id_fkey(
              name
            )
          `)
          .in("item_id", itemIds)
          .order("moved_at", { ascending: false })
          .limit(10)
      : { data: [], error: null };

    if (movementsError) {
      console.error("Error fetching movements:", movementsError);
    }

    return NextResponse.json({
      sku: {
        ...skuData,
        // Add any additional computed fields if needed
        total_items: (skuData.active_items_count || 0) + (skuData.completed_items_count || 0),
        active_items: skuData.active_items_count || 0,
        completed_items: skuData.completed_items_count || 0,
        workflow_stages_count: skuData.workflow_stages_count || 0,
        vendors_count: skuData.vendors_count || 0,
        samples_count: skuData.samples_count || 0,
        last_movement: skuData.last_movement,
        // Ensure backwards compatibility with existing modal code
        active_items_count: skuData.active_items_count || 0,
        completed_items_count: skuData.completed_items_count || 0,
      },
      items: items || [],
      workflow_stages: workflowStages || [],
      vendor_pricing: vendorPricing || [],
      samples: samples || [],
      recent_movements: recentMovements || [],
    });

  } catch (error) {
    console.error("Error in SKU details API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}