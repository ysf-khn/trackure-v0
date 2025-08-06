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

    // Get detailed SKU information
    const { data: skuData, error: skuError } = await supabase
      .from("item_master")
      .select(`
        sku,
        master_details,
        created_at,
        sku_cost_calculations(
          id,
          base_material_cost,
          total_workflow_cost,
          markup_percentage,
          final_calculated_cost,
          last_calculated_at,
          created_by,
          calculation_details
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .single();

    if (skuError) {
      console.error("Error fetching SKU:", skuError);
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    // Get item statistics
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id, total_quantity, remaining_quantity, status, created_at")
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id);

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
    }

    // Get workflow stages for this SKU
    const { data: workflowStages, error: stagesError } = await supabase
      .from("workflow_stages")
      .select(`
        id,
        name,
        stage_order,
        workflow_sub_stages(
          id,
          name,
          sub_stage_order
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .order("stage_order");

    if (stagesError) {
      console.error("Error fetching workflow stages:", stagesError);
    }

    // Get vendor pricing
    const { data: vendorPricing, error: vendorError } = await supabase
      .from("vendor_stage_pricing")
      .select(`
        id,
        stage_id,
        sub_stage_id,
        vendor_id,
        price_per_unit,
        created_at,
        vendors(
          id,
          name,
          contact_info
        ),
        workflow_stages(
          name
        ),
        workflow_sub_stages(
          name
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id);

    if (vendorError) {
      console.error("Error fetching vendor pricing:", vendorError);
    }

    // Get samples
    const { data: samples, error: samplesError } = await supabase
      .from("samples")
      .select(`
        id,
        stage_id,
        sample_name,
        image_url,
        description,
        created_at,
        workflow_stages(
          name
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id);

    if (samplesError) {
      console.error("Error fetching samples:", samplesError);
    }

    // Get recent movements
    const { data: recentMovements, error: movementsError } = await supabase
      .from("item_movement_history")
      .select(`
        id,
        quantity,
        moved_at,
        rework_reason,
        from_stage_id,
        to_stage_id,
        moved_by,
        workflow_stages!item_movement_history_from_stage_id_fkey(
          name
        ),
        to_stage:workflow_stages!item_movement_history_to_stage_id_fkey(
          name
        ),
        profiles(
          first_name,
          last_name
        )
      `)
      .eq("organization_id", profile.organization_id)
      .in("item_id", items?.map(i => i.id) || [])
      .order("moved_at", { ascending: false })
      .limit(10);

    if (movementsError) {
      console.error("Error fetching movements:", movementsError);
    }

    // Calculate statistics
    const stats = {
      total_items: items?.length || 0,
      active_items: items?.filter(i => i.status !== 'Completed').length || 0,
      completed_items: items?.filter(i => i.status === 'Completed').length || 0,
      total_quantity: items?.reduce((sum, i) => sum + (i.total_quantity || 0), 0) || 0,
      completed_quantity: items?.filter(i => i.status === 'Completed')
        .reduce((sum, i) => sum + (i.total_quantity || 0), 0) || 0,
      workflow_stages_count: workflowStages?.length || 0,
      vendors_count: new Set(vendorPricing?.map(vp => vp.vendor_id)).size || 0,
      samples_count: samples?.length || 0,
    };

    return NextResponse.json({
      sku: {
        ...skuData,
        sku_name: skuData.sku,
      },
      stats,
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