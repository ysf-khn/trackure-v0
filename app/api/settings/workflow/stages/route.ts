import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

const subStageSchema = z.object({
  name: z.string().min(1, "Sub-stage name cannot be empty."),
  location: z.string().optional(),
});

const vendorPricingSchema = z.object({
  vendor_id: z.string().uuid("Invalid vendor ID"),
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.string().min(1, "Currency is required"),
  price_unit: z.string().min(1, "Price unit is required"),
  minimum_quantity: z.number().int().min(1, "Minimum quantity must be at least 1"),
  lead_time_days: z.number().int().min(0, "Lead time cannot be negative"),
  notes: z.string().optional(),
});

const createStageSchema = z
  .object({
    name: z.string().min(1, "Stage name cannot be empty."),
    location: z.string().optional(), // Optional location field
    hasSubStages: z.boolean().optional(),
    subStages: z.array(subStageSchema).optional(),
    selectedSKU: z.string().nullable().optional(), // SKU for SKU-specific workflows
    parent_stage_id: z.string().uuid().nullable().optional(), // For infinite nesting
    vendorPricing: z.array(vendorPricingSchema).optional(), // Vendor pricing configuration
    // sequence_order will be calculated on the server
  })
  .refine(
    (data) => {
      // If hasSubStages is true, must have at least one sub-stage
      if (data.hasSubStages) {
        return data.subStages && data.subStages.length > 0;
      }
      return true;
    },
    {
      message: "At least one sub-stage is required when sub-stages are enabled",
    }
  );

export async function POST(request: Request) {
  // const cookieStore = cookies();
  const supabase = await createClient();

  try {
    // Use getUserWithProfile
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

    // RBAC Check: Check permission for workers
    if (profile.role === "Worker") {
      // Check if worker has permission to edit workflow
      const { data: hasPermission, error: permissionError } =
        await supabase.rpc("worker_has_permission", {
          permission_key: "workflow.edit",
        });

      if (permissionError) {
        console.error("Error checking permissions:", permissionError);
        return NextResponse.json(
          { error: "Failed to verify permissions" },
          { status: 500 }
        );
      }

      if (!hasPermission) {
        return NextResponse.json(
          { error: "Forbidden: You don't have permission to edit workflow" },
          { status: 403 }
        );
      }
    } else if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Only Owners can add stages." },
        { status: 403 }
      );
    }

    const organization_id = profile.organization_id;

    const body = await request.json();
    const validation = createStageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, location, hasSubStages, subStages, selectedSKU, parent_stage_id, vendorPricing } = validation.data;

    // Calculate next sequence_order using simple max + 1 logic
    // Completed stages now use sequence order 100000, so they won't interfere
    let maxOrderQuery = supabase
      .from("workflow_stages")
      .select("sequence_order")
      .eq("organization_id", organization_id)
      .lt("sequence_order", 50000); // Only consider stages with reasonable sequence orders

    // Filter by SKU if selected
    if (selectedSKU) {
      maxOrderQuery = maxOrderQuery.eq("sku", selectedSKU);
    } else {
      maxOrderQuery = maxOrderQuery.is("sku", null);
    }

    // Filter by parent_stage_id to get sequence within the same level
    if (parent_stage_id) {
      maxOrderQuery = maxOrderQuery.eq("parent_stage_id", parent_stage_id);
    } else {
      maxOrderQuery = maxOrderQuery.is("parent_stage_id", null);
    }

    const { data: maxOrderData, error: maxOrderError } = await maxOrderQuery
      .order("sequence_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxOrderError && maxOrderError.code !== "PGRST116") {
      console.error("Error fetching max sequence order:", maxOrderError);
      return NextResponse.json(
        { error: "Failed to determine stage order." },
        { status: 500 }
      );
    }

    const nextSequenceOrder = maxOrderData
      ? maxOrderData.sequence_order + 1
      : 0;

    // Calculate depth level
    let depth_level = 0;
    if (parent_stage_id) {
      const { data: parentStage } = await supabase
        .from("workflow_stages")
        .select("depth_level")
        .eq("id", parent_stage_id)
        .single();
      depth_level = (parentStage?.depth_level || 0) + 1;
    }

    // Insert new stage
    const { data: newStage, error: insertError } = await supabase
      .from("workflow_stages")
      .insert({
        name: name,
        location: location,
        sequence_order: nextSequenceOrder,
        organization_id: organization_id,
        sku: selectedSKU, // Add SKU to the insert
        parent_stage_id: parent_stage_id, // Add parent_stage_id for infinite nesting
        depth_level: depth_level, // Add depth level
        is_leaf_stage: true, // New stages are leaf stages by default
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting stage:", insertError);
      return NextResponse.json(
        { error: "Failed to create stage." },
        { status: 500 }
      );
    }

    // If this is a sub-stage (has parent), update parent's is_leaf_stage to false
    if (parent_stage_id) {
      await supabase
        .from("workflow_stages")
        .update({ is_leaf_stage: false })
        .eq("id", parent_stage_id);
    }

    // If sub-stages are provided, create them as child stages in the tree structure
    if (hasSubStages && subStages && subStages.length > 0) {
      // Update the parent stage to not be a leaf
      await supabase
        .from("workflow_stages")
        .update({ is_leaf_stage: false })
        .eq("id", newStage.id);

      const subStageInserts = subStages.map((subStage, index) => ({
        name: subStage.name,
        location: subStage.location,
        sequence_order: index,
        parent_stage_id: newStage.id, // Set the parent_stage_id to create tree hierarchy
        organization_id: organization_id,
        sku: selectedSKU,
        depth_level: depth_level + 1,
        is_leaf_stage: true,
      }));

      const { error: subStageError } = await supabase
        .from("workflow_stages")
        .insert(subStageInserts);

      if (subStageError) {
        console.error("Error inserting sub-stages:", subStageError);
        // Clean up the stage if sub-stage creation fails
        await supabase.from("workflow_stages").delete().eq("id", newStage.id);

        return NextResponse.json(
          { error: "Failed to create sub-stages." },
          { status: 500 }
        );
      }
    }

    // Handle vendor pricing for leaf stages only
    if (vendorPricing && vendorPricing.length > 0 && selectedSKU) {
      // Only create vendor pricing for leaf stages
      const targetStageId = newStage.is_leaf_stage ? newStage.id : null;
      
      if (targetStageId) {
        const vendorPricingInserts = vendorPricing.map((pricing) => ({
          vendor_id: pricing.vendor_id,
          stage_id: targetStageId,
          sku: selectedSKU,
          organization_id: organization_id,
          price: pricing.price,
          currency: pricing.currency,
          price_unit: pricing.price_unit,
          minimum_quantity: pricing.minimum_quantity,
          lead_time_days: pricing.lead_time_days,
          notes: pricing.notes || null,
          is_active: true,
          created_by: user.id,
        }));

        const { error: vendorPricingError } = await supabase
          .from("vendor_stage_pricing")
          .insert(vendorPricingInserts);

        if (vendorPricingError) {
          console.error("Error inserting vendor pricing:", vendorPricingError);
          // Don't fail the stage creation, just log the error
          // The user can add vendor pricing later
        }
      }
    }

    return NextResponse.json(newStage, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/settings/workflow/stages:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
