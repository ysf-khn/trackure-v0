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

    // Get SKU data with aggregated counts
    const { data: skus, error: skusError } = await supabase
      .from("item_master")
      .select(`
        sku,
        items!inner(
          id,
          total_quantity,
          remaining_quantity,
          status,
          created_at,
          item_movement_history!item_movement_history_item_id_fkey(
            moved_at
          )
        ),
        sku_cost_calculations(
          final_calculated_cost,
          last_calculated_at
        )
      `)
      .eq("organization_id", profile.organization_id);

    if (skusError) {
      console.error("Error fetching SKUs:", skusError);
      return NextResponse.json({ error: "Failed to fetch SKU data" }, { status: 500 });
    }

    // Get workflow stages count for each SKU
    const { data: workflowStages, error: workflowError } = await supabase
      .from("workflow_stages")
      .select("sku, id")
      .eq("organization_id", profile.organization_id);

    if (workflowError) {
      console.error("Error fetching workflow stages:", workflowError);
    }

    // Get vendor counts for each SKU
    const { data: vendorPricing, error: vendorError } = await supabase
      .from("vendor_stage_pricing")
      .select("sku, vendor_id")
      .eq("organization_id", profile.organization_id);

    if (vendorError) {
      console.error("Error fetching vendor pricing:", vendorError);
    }

    // Get sample counts for each SKU
    const { data: samples, error: samplesError } = await supabase
      .from("samples")
      .select("sku, id")
      .eq("organization_id", profile.organization_id);

    if (samplesError) {
      console.error("Error fetching samples:", samplesError);
    }

    // Process SKU data
    const skuMap = new Map();
    
    // Initialize SKU data
    skus?.forEach(sku => {
      if (!skuMap.has(sku.sku)) {
        skuMap.set(sku.sku, {
          sku: sku.sku,
          sku_name: sku.sku,
          active_items_count: 0,
          completed_items_count: 0,
          workflow_stages_count: 0,
          vendors_count: 0,
          samples_count: 0,
          final_calculated_cost: sku.sku_cost_calculations?.[0]?.final_calculated_cost,
          last_calculated_at: sku.sku_cost_calculations?.[0]?.last_calculated_at,
          last_movement: null,
        });
      }
      
      const skuData = skuMap.get(sku.sku);
      
      // Count items by status
      sku.items?.forEach(item => {
        if (item.status === 'Completed') {
          skuData.completed_items_count += item.total_quantity || 1;
        } else {
          skuData.active_items_count += item.total_quantity || 1;
        }
        
        // Get latest movement
        const latestMovement = item.item_movement_history?.[0]?.moved_at;
        if (latestMovement && (!skuData.last_movement || latestMovement > skuData.last_movement)) {
          skuData.last_movement = latestMovement;
        }
      });
    });

    // Add workflow stages count
    workflowStages?.forEach(stage => {
      if (skuMap.has(stage.sku)) {
        skuMap.get(stage.sku).workflow_stages_count++;
      }
    });

    // Add vendor counts
    const vendorCounts = new Map();
    vendorPricing?.forEach(pricing => {
      if (!vendorCounts.has(pricing.sku)) {
        vendorCounts.set(pricing.sku, new Set());
      }
      vendorCounts.get(pricing.sku).add(pricing.vendor_id);
    });
    
    vendorCounts.forEach((vendorSet, sku) => {
      if (skuMap.has(sku)) {
        skuMap.get(sku).vendors_count = vendorSet.size;
      }
    });

    // Add sample counts
    samples?.forEach(sample => {
      if (sample.sku && skuMap.has(sample.sku)) {
        skuMap.get(sample.sku).samples_count++;
      }
    });

    const processedSKUs = Array.from(skuMap.values());

    // Calculate stats
    const stats = {
      total_skus: processedSKUs.length,
      active_skus: processedSKUs.filter(sku => sku.active_items_count > 0).length,
      avg_cost: processedSKUs.reduce((sum, sku) => sum + (sku.final_calculated_cost || 0), 0) / 
                Math.max(1, processedSKUs.filter(sku => sku.final_calculated_cost).length),
      total_active_items: processedSKUs.reduce((sum, sku) => sum + sku.active_items_count, 0),
      total_vendors: vendorPricing?.length || 0,
    };

    return NextResponse.json({
      skus: processedSKUs,
      stats,
    });

  } catch (error) {
    console.error("Error in SKU management API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}