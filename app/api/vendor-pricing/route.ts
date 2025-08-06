import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get("stage_id");
    const organizationId = searchParams.get("organization_id");

    if (!stageId || !organizationId) {
      return NextResponse.json({ 
        error: "stage_id and organization_id are required" 
      }, { status: 400 });
    }

    // Verify organization access
    if (organizationId !== profile.organization_id) {
      return NextResponse.json({ error: "Unauthorized access to organization" }, { status: 403 });
    }

    // Build the query
    let query = supabase
      .from("vendor_stage_pricing")
      .select(`
        vendor_id,
        sku,
        price,
        currency,
        notes,
        updated_at,
        vendors!inner(
          name
        ),
        workflow_stages!inner(
          name,
          full_path
        )
      `)
      .eq("organization_id", organizationId)
      .eq("stage_id", stageId);

    const { data: vendorPricing, error: pricingError } = await query;

    if (pricingError) {
      console.error("Error fetching vendor pricing:", pricingError);
      return NextResponse.json({ error: "Failed to fetch vendor pricing" }, { status: 500 });
    }

    // Transform the data for the frontend
    const transformedData = vendorPricing?.map(pricing => ({
      vendor_id: pricing.vendor_id,
      vendor_name: pricing.vendors.name,
      pricing_per_unit: pricing.price,
      currency: pricing.currency || "₹",
      stage_name: pricing.workflow_stages.name,
      full_path: pricing.workflow_stages.full_path,
      sku: pricing.sku,
      last_updated: pricing.updated_at,
      notes: pricing.notes,
    })) || [];

    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Error in vendor pricing API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}