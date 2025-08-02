import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { sku: string } }
) {
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

    // Get cost calculation for the SKU
    const { data: cost, error: costError } = await supabase
      .from("cost_calculations")
      .select("*")
      .eq("sku", params.sku)
      .eq("organization_id", profile.organization_id)
      .order("last_calculated_at", { ascending: false })
      .limit(1)
      .single();

    if (costError && costError.code !== 'PGRST116') {
      console.error("Error fetching cost calculation:", costError);
      return NextResponse.json({ error: "Failed to fetch cost calculation" }, { status: 500 });
    }

    return NextResponse.json({
      cost: cost || null,
    });

  } catch (error) {
    console.error("Error in cost calculation GET API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sku: string } }
) {
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

    const body = await request.json();
    const {
      material_cost,
      labor_cost,
      overhead_percentage,
      profit_margin_percentage,
      additional_costs,
      final_calculated_cost,
    } = body;

    // Validate required fields
    if (typeof final_calculated_cost !== 'number') {
      return NextResponse.json({ error: "Final calculated cost is required" }, { status: 400 });
    }

    // Check if cost calculation already exists
    const { data: existingCost } = await supabase
      .from("cost_calculations")
      .select("id")
      .eq("sku", params.sku)
      .eq("organization_id", profile.organization_id)
      .single();

    const costData = {
      sku: params.sku,
      organization_id: profile.organization_id,
      material_cost: material_cost || 0,
      labor_cost: labor_cost || 0,
      overhead_percentage: overhead_percentage || 0,
      profit_margin_percentage: profit_margin_percentage || 0,
      additional_costs: additional_costs || 0,
      final_calculated_cost,
      last_calculated_at: new Date().toISOString(),
      calculated_by: user.id,
    };

    let result;
    if (existingCost) {
      // Update existing cost calculation
      const { data, error } = await supabase
        .from("cost_calculations")
        .update(costData)
        .eq("id", existingCost.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating cost calculation:", error);
        return NextResponse.json({ error: "Failed to update cost calculation" }, { status: 500 });
      }
      result = data;
    } else {
      // Create new cost calculation
      const { data, error } = await supabase
        .from("cost_calculations")
        .insert(costData)
        .select()
        .single();

      if (error) {
        console.error("Error creating cost calculation:", error);
        return NextResponse.json({ error: "Failed to create cost calculation" }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({
      cost: result,
      message: existingCost ? "Cost calculation updated successfully" : "Cost calculation created successfully",
    });

  } catch (error) {
    console.error("Error in cost calculation POST API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}