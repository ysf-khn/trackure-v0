import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

const vendorPricingSchema = z.object({
  vendor_id: z.string().uuid("Invalid vendor ID"),
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.string().min(1, "Currency is required"),
  minimum_quantity: z
    .number()
    .int()
    .min(1, "Minimum quantity must be at least 1"),
  lead_time_days: z.number().int().min(0, "Lead time cannot be negative"),
  notes: z.string().optional(),
});

const updateVendorPricingSchema = z.array(vendorPricingSchema);

// GET - Fetch vendor pricing for a stage
export async function GET(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const supabase = await createClient();

  try {
    const {
      user,
      profile,
      error: userProfileError,
    } = await getUserWithProfile(supabase);

    if (userProfileError || !user || !profile) {
      return NextResponse.json(
        { error: userProfileError?.message || "Unauthorized" },
        { status: 401 }
      );
    }

    const { stageId } = await params;
    const organization_id = profile.organization_id;

    // Fetch vendor pricing for the stage
    const { data: vendorPricing, error } = await supabase
      .from("vendor_stage_pricing")
      .select(
        `
        *,
        vendors!inner(id, name, firm_name, is_active)
      `
      )
      .eq("stage_id", stageId)
      .eq("organization_id", organization_id)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching vendor pricing:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor pricing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ vendorPricing });
  } catch (error) {
    console.error("Error in GET vendor pricing:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PUT - Update vendor pricing for a stage
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const supabase = await createClient();

  try {
    const {
      user,
      profile,
      error: userProfileError,
    } = await getUserWithProfile(supabase);

    if (userProfileError || !user || !profile) {
      return NextResponse.json(
        { error: userProfileError?.message || "Unauthorized" },
        { status: 401 }
      );
    }

    // RBAC Check
    if (profile.role === "Worker") {
      const { data: hasPermission, error: permissionError } =
        await supabase.rpc("worker_has_permission", {
          permission_key: "workflow.edit",
        });

      if (permissionError || !hasPermission) {
        return NextResponse.json(
          { error: "Forbidden: You don't have permission to edit workflow" },
          { status: 403 }
        );
      }
    } else if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Only Owners can edit vendor pricing" },
        { status: 403 }
      );
    }

    const { stageId } = await params;
    const organization_id = profile.organization_id;

    const body = await request.json();
    const validation = updateVendorPricingSchema.safeParse(body.vendorPricing);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const vendorPricing = validation.data;
    const { sku } = body;

    if (!sku) {
      return NextResponse.json(
        { error: "SKU is required for vendor pricing" },
        { status: 400 }
      );
    }

    // Verify stage exists and is a leaf stage
    const { data: stage, error: stageError } = await supabase
      .from("workflow_stages")
      .select("id, is_leaf_stage, sku")
      .eq("id", stageId)
      .eq("organization_id", organization_id)
      .single();

    if (stageError || !stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    if (!stage.is_leaf_stage) {
      return NextResponse.json(
        { error: "Vendor pricing can only be set for leaf stages" },
        { status: 400 }
      );
    }

    // Delete existing vendor pricing for this stage
    await supabase
      .from("vendor_stage_pricing")
      .delete()
      .eq("stage_id", stageId)
      .eq("organization_id", organization_id);

    // Insert new vendor pricing
    if (vendorPricing.length > 0) {
      const vendorPricingInserts = vendorPricing.map((pricing) => ({
        vendor_id: pricing.vendor_id,
        stage_id: stageId,
        sku: sku,
        organization_id: organization_id,
        price: pricing.price,
        currency: pricing.currency,
        price_unit: "per_piece", // Always per piece as established
        minimum_quantity: pricing.minimum_quantity,
        lead_time_days: pricing.lead_time_days,
        notes: pricing.notes || null,
        is_active: true,
        created_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from("vendor_stage_pricing")
        .insert(vendorPricingInserts);

      if (insertError) {
        console.error("Error inserting vendor pricing:", insertError);
        return NextResponse.json(
          { error: "Failed to update vendor pricing" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      message: "Vendor pricing updated successfully",
    });
  } catch (error) {
    console.error("Error in PUT vendor pricing:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
