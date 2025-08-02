import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Cost calculation request schema
const costCalculationSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().positive("Quantity must be positive").default(1),
  base_material_cost: z.number().min(0).default(0),
  markup_percentage: z.number().min(0).max(100).default(0),
  workflow_path: z.array(z.string().uuid()).optional(), // Optional specific workflow path
});

// GET - Calculate costs for a SKU
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const sku = searchParams.get('sku');
  const quantity = parseInt(searchParams.get('quantity') || '1');
  const baseMaterialCost = parseFloat(searchParams.get('base_material_cost') || '0');
  const markupPercentage = parseFloat(searchParams.get('markup_percentage') || '0');

  if (!sku) {
    return NextResponse.json(
      { error: "SKU parameter is required" },
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
    // Call the database function to calculate workflow cost
    const { data: costResult, error: costError } = await supabase.rpc(
      "calculate_workflow_cost",
      {
        p_sku: sku,
        p_organization_id: profile.organization_id,
        p_quantity: quantity,
        p_workflow_path: null, // Use default workflow path
      }
    );

    if (costError) {
      console.error("Error calculating workflow cost:", costError);
      return NextResponse.json(
        { error: "Failed to calculate workflow cost" },
        { status: 500 }
      );
    }

    // Get SKU details
    const { data: skuDetails, error: skuError } = await supabase
      .from("item_master")
      .select("name, description, specifications")
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .single();

    if (skuError) {
      return NextResponse.json(
        { error: "SKU not found" },
        { status: 404 }
      );
    }

    // Get existing cost calculation if any
    const { data: existingCalculation } = await supabase
      .from("sku_cost_calculations")
      .select("*")
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .single();

    const result = costResult[0]; // Function returns array with single result
    const workflowCost = result?.total_cost || 0;
    const subtotal = baseMaterialCost + workflowCost;
    const markupAmount = subtotal * (markupPercentage / 100);
    const finalCost = subtotal + markupAmount;

    const calculationResult = {
      sku,
      sku_details: skuDetails,
      quantity,
      cost_breakdown: {
        base_material_cost: baseMaterialCost,
        workflow_cost: workflowCost,
        subtotal,
        markup_percentage: markupPercentage,
        markup_amount: markupAmount,
        final_cost: finalCost,
        cost_per_piece: quantity > 0 ? finalCost / quantity : 0,
        currency: result?.currency || 'INR',
      },
      workflow_breakdown: result?.cost_breakdown || [],
      existing_calculation: existingCalculation,
      calculated_at: new Date().toISOString(),
    };

    return NextResponse.json(calculationResult);

  } catch (error) {
    console.error("Cost calculation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Save a cost calculation
export async function POST(request: Request) {
  const supabase = await createClient();

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user permissions
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 }
    );
  }

  // Only owners can save cost calculations
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can save cost calculations" },
      { status: 403 }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const validationResult = costCalculationSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const { sku, quantity, base_material_cost, markup_percentage, workflow_path } = validationResult.data;

  try {
    // Call the database function to update SKU cost calculation
    const { data: calculationId, error: calculationError } = await supabase.rpc(
      "update_sku_cost_calculation",
      {
        p_sku: sku,
        p_organization_id: profile.organization_id,
        p_base_material_cost: base_material_cost,
        p_markup_percentage: markup_percentage,
        p_workflow_type: 'sku', // Default to SKU-specific
      }
    );

    if (calculationError) {
      console.error("Error saving cost calculation:", calculationError);
      return NextResponse.json(
        { error: "Failed to save cost calculation", details: calculationError.message },
        { status: 500 }
      );
    }

    // Fetch the saved calculation to return
    const { data: savedCalculation, error: fetchError } = await supabase
      .from("sku_cost_calculations")
      .select("*")
      .eq("id", calculationId)
      .single();

    if (fetchError) {
      console.error("Error fetching saved calculation:", fetchError);
      return NextResponse.json(
        { error: "Cost calculation saved but failed to retrieve details" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Cost calculation saved successfully",
      calculation: savedCalculation,
    }, { status: 201 });

  } catch (error) {
    console.error("Cost calculation save error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing cost calculation
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const calculationId = searchParams.get('id');

  if (!calculationId) {
    return NextResponse.json(
      { error: "Calculation ID is required" },
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

  // Check user permissions
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 }
    );
  }

  // Only owners can update cost calculations
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can update cost calculations" },
      { status: 403 }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const updateSchema = z.object({
    base_material_cost: z.number().min(0).optional(),
    markup_percentage: z.number().min(0).max(100).optional(),
    is_active: z.boolean().optional(),
  });

  const validationResult = updateSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const updateData = validationResult.data;

  try {
    // Update the calculation
    const { data: updatedCalculation, error: updateError } = await supabase
      .from("sku_cost_calculations")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calculationId)
      .eq("organization_id", profile.organization_id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Cost calculation not found or access denied" },
          { status: 404 }
        );
      }
      console.error("Error updating cost calculation:", updateError);
      return NextResponse.json(
        { error: "Failed to update cost calculation", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Cost calculation updated successfully",
      calculation: updatedCalculation,
    });

  } catch (error) {
    console.error("Cost calculation update error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}