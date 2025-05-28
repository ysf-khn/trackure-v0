import { determinePreviousStage, WorkflowStage } from "@/lib/workflow-utils";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Zod schema for input validation - Updated for items with quantity
const reworkInputSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("Quantity must be a positive number."),
        source_stage_id: z.string().uuid("Invalid source stage ID."),
        source_sub_stage_id: z
          .string()
          .uuid("Invalid source sub-stage ID.")
          .nullable(),
      })
    )
    .min(1, "At least one item is required."),
  rework_reason: z
    .string()
    .min(3, "Rework reason must be at least 3 characters long.")
    .max(255, "Rework reason must be at most 255 characters long."),
  target_rework_stage_id: z.string().uuid("Invalid target stage ID."),
  target_rework_sub_stage_id: z
    .string()
    .uuid("Invalid target sub-stage ID.")
    .nullable()
    .optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // --- Start: Standard Auth & Profile Fetch (Identical to Move Forward) --- //
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Auth Error [Rework API]:", authError);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
  if (!authData.user) {
    console.error("Auth Error [Rework API]: No user found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = authData.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id || !profile.role) {
    console.error(
      `Profile Error/Missing Data [Rework API] for user ${user.id}:`,
      profileError?.message
    );
    return NextResponse.json(
      {
        error: profileError?.message || "Unauthorized: User profile not found.",
      },
      { status: 401 }
    );
  }
  const organizationId = profile.organization_id; // Renamed for clarity
  const userRole = profile.role;
  // --- End: Standard Auth & Profile Fetch --- //

  // RBAC Check: Allow both Owner and Worker to perform rework actions
  if (!["Owner", "Worker"].includes(userRole)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions." },
      { status: 403 }
    );
  }

  // Validate request body
  const requestBody = await request.json();
  const parseResult = await reworkInputSchema.safeParseAsync(requestBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const {
    items: itemsToRework,
    rework_reason,
    target_rework_stage_id,
    target_rework_sub_stage_id,
  } = parseResult.data;

  try {
    // Fetch workflow configuration
    const { data: workflowStagesData, error: workflowError } = await supabase
      .from("workflow_stages")
      .select(
        "id, sequence_order, sub_stages:workflow_sub_stages ( id, sequence_order )"
      )
      .eq("organization_id", organizationId)
      .order("sequence_order", { ascending: true })
      .order("sequence_order", {
        foreignTable: "workflow_sub_stages",
        ascending: true,
      });

    if (workflowError || !workflowStagesData) {
      console.error("Rework API Workflow Fetch Error:", workflowError);
      return NextResponse.json(
        { error: "Failed to fetch workflow configuration." },
        { status: 500 }
      );
    }

    // Validate that target stage exists in workflow
    const targetStageExists = workflowStagesData.some(
      (stage) => stage.id === target_rework_stage_id
    );
    if (!targetStageExists) {
      return NextResponse.json(
        { error: "Invalid target stage: Stage not found in workflow." },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];
    const timestamp = new Date().toISOString();

    for (const itemInput of itemsToRework) {
      const {
        id: itemId,
        quantity: requestedQuantity,
        source_stage_id,
        source_sub_stage_id,
      } = itemInput;

      // Fetch current item allocation state - now with stage filters
      let { data: currentAllocation, error: allocationError } = await supabase
        .from("item_stage_allocations")
        .select("id, stage_id, sub_stage_id, quantity, organization_id")
        .eq("item_id", itemId)
        .eq("organization_id", organizationId)
        .eq("stage_id", source_stage_id)
        .single();

      // Add sub-stage filter if it exists
      if (source_sub_stage_id) {
        const { data: subStageAllocation, error: subStageError } =
          await supabase
            .from("item_stage_allocations")
            .select("id, stage_id, sub_stage_id, quantity, organization_id")
            .eq("item_id", itemId)
            .eq("organization_id", organizationId)
            .eq("stage_id", source_stage_id)
            .eq("sub_stage_id", source_sub_stage_id)
            .single();

        if (subStageError || !subStageAllocation) {
          errors.push({
            itemId,
            error: `Allocation for item not found in specified sub-stage. ${subStageError?.message || ""}`,
          });
          continue;
        }

        if (requestedQuantity > subStageAllocation.quantity) {
          errors.push({
            itemId,
            error: `Requested rework quantity (${requestedQuantity}) exceeds available quantity (${subStageAllocation.quantity}) in sub-stage.`,
          });
          continue;
        }

        // Use the sub-stage allocation
        currentAllocation = subStageAllocation;
      } else {
        // If no sub-stage, use the stage allocation
        if (allocationError || !currentAllocation) {
          errors.push({
            itemId,
            error: `Allocation for item not found in specified stage. ${allocationError?.message || ""}`,
          });
          continue;
        }

        if (requestedQuantity > currentAllocation.quantity) {
          errors.push({
            itemId,
            error: `Requested rework quantity (${requestedQuantity}) exceeds available quantity (${currentAllocation.quantity}) in stage.`,
          });
          continue;
        }
      }

      // Handle the source allocation for Rework
      if (requestedQuantity === currentAllocation.quantity) {
        // FULL REWORK from source: Delete the source allocation
        const { error: deleteSourceError } = await supabase
          .from("item_stage_allocations")
          .delete()
          .eq("id", currentAllocation.id);

        if (deleteSourceError) {
          console.error("Delete source error:", deleteSourceError);
          errors.push({
            itemId,
            error: `Failed to remove source item allocation for full rework. ${deleteSourceError.message}`,
          });
          continue;
        }
      } else {
        console.log("Partial rework - updating source allocation:");
        // PARTIAL REWORK from source: Reduce quantity
        const { error: existingUpdateError } = await supabase
          .from("item_stage_allocations")
          .update({
            quantity: currentAllocation.quantity - requestedQuantity,
            updated_at: timestamp,
          })
          .eq("id", currentAllocation.id);

        if (existingUpdateError) {
          console.error("Update source error:", existingUpdateError);
          errors.push({
            itemId,
            error: `Failed to update existing allocation (partial rework). ${existingUpdateError.message}`,
          });
          continue;
        }
      }

      // Handle the target allocation for Rework
      let targetAllocationQuery = supabase
        .from("item_stage_allocations")
        .select("id, quantity")
        .eq("item_id", itemId)
        .eq("organization_id", organizationId)
        .eq("stage_id", target_rework_stage_id);

      if (target_rework_sub_stage_id === null) {
        targetAllocationQuery = targetAllocationQuery.is("sub_stage_id", null);
      } else {
        targetAllocationQuery = targetAllocationQuery.eq(
          "sub_stage_id",
          target_rework_sub_stage_id
        );
      }

      const { data: targetAllocation, error: targetAllocationFetchError } =
        await targetAllocationQuery.limit(1).single();

      if (
        targetAllocationFetchError &&
        targetAllocationFetchError.code !== "PGRST116" // PGRST116: single row not found
      ) {
        errors.push({
          itemId,
          error: `Failed to check for existing target rework allocation. ${targetAllocationFetchError.message}`,
        });
        continue;
      }

      if (targetAllocation) {
        // Target allocation exists: Update its quantity
        const { error: targetUpdateError } = await supabase
          .from("item_stage_allocations")
          .update({
            quantity: targetAllocation.quantity + requestedQuantity,
            updated_at: timestamp,
            moved_by: user.id,
          })
          .eq("id", targetAllocation.id);

        if (targetUpdateError) {
          errors.push({
            itemId,
            error: `DATA INCONSISTENCY: Failed to update target rework allocation. Source modified. ${targetUpdateError.message}`,
          });
          continue;
        }
      } else {
        // No target allocation exists: Create a new one
        const newAllocationData = {
          item_id: itemId,
          organization_id: organizationId,
          stage_id: target_rework_stage_id,
          sub_stage_id: target_rework_sub_stage_id,
          quantity: requestedQuantity,
          created_at: timestamp,
          updated_at: timestamp,
          moved_by: user.id,
        };
        const { error: newInsertError } = await supabase
          .from("item_stage_allocations")
          .insert(newAllocationData);

        if (newInsertError) {
          errors.push({
            itemId,
            error: `DATA INCONSISTENCY: Failed to create new allocation for reworked part. Source modified. ${newInsertError.message}`,
          });
          continue;
        }
      }

      // Insert movement history record
      const { error: movementLogInsertError } = await supabase
        .from("item_movement_history")
        .insert({
          item_id: itemId,
          from_stage_id: currentAllocation.stage_id,
          from_sub_stage_id: currentAllocation.sub_stage_id,
          to_stage_id: target_rework_stage_id,
          to_sub_stage_id: target_rework_sub_stage_id,
          quantity: requestedQuantity,
          moved_at: timestamp,
          moved_by: user.id,
          organization_id: organizationId,
          rework_reason: rework_reason,
        });

      if (movementLogInsertError) {
        errors.push({
          itemId,
          error: `Failed to log rework movement history. ${movementLogInsertError.message}`,
        });
        continue;
      }

      results.push({
        itemId,
        status: "success",
        reworkedToStageId: target_rework_stage_id,
        reworkedToSubStageId: target_rework_sub_stage_id,
        quantity: requestedQuantity,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          message: `Processed ${itemsToRework.length} items for rework. Success: ${results.length}, Failures: ${errors.length}.`,
          results,
          errors,
        },
        { status: errors.length === itemsToRework.length ? 500 : 207 }
      );
    }

    return NextResponse.json(
      { message: `Successfully reworked ${results.length} items.`, results },
      { status: 200 }
    );
  } catch (error) {
    console.error("Rework API Unhandled Error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred.";
    return NextResponse.json(
      { error: "An unexpected server error occurred.", details: errorMessage },
      { status: 500 }
    );
  }
}
