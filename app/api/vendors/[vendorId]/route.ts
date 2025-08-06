import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Vendor update schema
const vendorUpdateSchema = z.object({
  name: z.string().min(1, "Vendor name is required").optional(),
  firm_name: z.string().optional(),
  gst: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  remarks: z.string().optional(),
  is_active: z.boolean().optional(),
});

// GET - Get a specific vendor by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: vendor, error } = await supabase
      .from("vendors")
      .select(
        `
        id,
        name,
        firm_name,
        gst,
        address,
        phone,
        email,
        remarks,
        is_active,
        created_at,
        updated_at,
        pricing:vendor_stage_pricing(
          id,
          stage_id,
          sku,
          price,
          currency,
          price_unit,
          minimum_quantity,
          lead_time_days,
          is_active,
          notes,
          created_at,
          stage:workflow_stages(id, name, full_path),
          sku_details:item_master(master_details)
        ),
        assignments:item_vendor_assignments(
          id,
          item_id,
          quantity,
          price_per_unit,
          total_price,
          assigned_at,
          completed_at,
          item:items(sku, total_quantity)
        )
      `
      )
      .eq("id", vendorId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching vendor:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor" },
        { status: 500 }
      );
    }

    // Calculate vendor performance metrics
    const activePricing = vendor.pricing.filter((p) => p.is_active);
    const completedAssignments = vendor.assignments.filter(
      (a) => a.completed_at
    );
    const activeAssignments = vendor.assignments.filter((a) => !a.completed_at);

    const vendorWithMetrics = {
      ...vendor,
      metrics: {
        total_pricing_entries: vendor.pricing.length,
        active_pricing_entries: activePricing.length,
        supported_skus: new Set(activePricing.map((p) => p.sku)).size,
        supported_stages: new Set(activePricing.map((p) => p.stage_id)).size,
        total_assignments: vendor.assignments.length,
        completed_assignments: completedAssignments.length,
        active_assignments: activeAssignments.length,
        total_revenue: completedAssignments.reduce(
          (sum, a) => sum + Number(a.total_price || 0),
          0
        ),
        avg_completion_time:
          completedAssignments.length > 0
            ? completedAssignments.reduce((sum, a) => {
                const days =
                  (new Date(a.completed_at).getTime() -
                    new Date(a.assigned_at).getTime()) /
                  (1000 * 60 * 60 * 24);
                return sum + days;
              }, 0) / completedAssignments.length
            : 0,
        price_range:
          activePricing.length > 0
            ? {
                min: Math.min(...activePricing.map((p) => Number(p.price))),
                max: Math.max(...activePricing.map((p) => Number(p.price))),
                avg:
                  activePricing.reduce((sum, p) => sum + Number(p.price), 0) /
                  activePricing.length,
              }
            : null,
      },
    };

    return NextResponse.json({ vendor: vendorWithMetrics });
  } catch (error) {
    console.error("Vendor GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PUT - Update a vendor
export async function PUT(
  request: Request,
  { params }: { params: { vendorId: string } }
) {
  const supabase = await createClient();
  const { vendorId } = params;

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

  // Only owners can update vendors
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can update vendors" },
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

  const validationResult = vendorUpdateSchema.safeParse(body);
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
    const { data: updatedVendor, error: updateError } = await supabase
      .from("vendors")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vendorId)
      .eq("organization_id", profile.organization_id) // Ensure user can only update their org's vendors
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Vendor not found or access denied" },
          { status: 404 }
        );
      }
      console.error("Error updating vendor:", updateError);
      return NextResponse.json(
        { error: "Failed to update vendor", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Vendor updated successfully",
      vendor: updatedVendor,
    });
  } catch (error) {
    console.error("Vendor update error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a vendor
export async function DELETE(
  request: Request,
  { params }: { params: { vendorId: string } }
) {
  const supabase = await createClient();
  const { vendorId } = params;

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

  // Only owners can delete vendors
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can delete vendors" },
      { status: 403 }
    );
  }

  try {
    // Check if vendor has any active assignments
    const { data: activeAssignments, error: assignmentError } = await supabase
      .from("item_vendor_assignments")
      .select("id")
      .eq("vendor_id", vendorId)
      .is("completed_at", null);

    if (assignmentError) {
      console.error("Error checking vendor assignments:", assignmentError);
      return NextResponse.json(
        { error: "Failed to check vendor assignments" },
        { status: 500 }
      );
    }

    if (activeAssignments && activeAssignments.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete vendor with active assignments",
          details: `Vendor has ${activeAssignments.length} active assignment(s)`,
        },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false instead of hard delete
    const { data: deletedVendor, error: deleteError } = await supabase
      .from("vendors")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vendorId)
      .eq("organization_id", profile.organization_id)
      .select()
      .single();

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Vendor not found or access denied" },
          { status: 404 }
        );
      }
      console.error("Error deleting vendor:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete vendor", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Vendor deactivated successfully",
      vendor: deletedVendor,
    });
  } catch (error) {
    console.error("Vendor deletion error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
