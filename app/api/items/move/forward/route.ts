import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { determineNextStage, WorkflowStage } from "@/lib/workflow-utils";

// Use the specific type from the utils file if needed, or define locally
// type FetchedStage = {
//   id: string;
//   sequence_order: number;
//   sub_stages: { id: string; sequence_order: number }[];
// };

// Define the expected request body schema
const moveForwardSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("Quantity must be a positive number."),
      })
    )
    .min(1, "At least one item is required."),
  target_stage_id: z.string().uuid().optional().nullable(), // Optional target stage
  source_stage_id: z.string().uuid().optional().nullable(), // Optional source stage to prioritize
});

export async function POST(request: Request) {
  // const cookieStore = cookies();
  const supabase = await createClient();

  // 1. Verify Authentication & Authorization
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("Move Forward Auth Error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user profile to get organization_id and role (adjust table/column names)
  const { data: profile, error: profileError } = await supabase
    .from("profiles") // Assuming 'profiles' table stores org and role
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Move Forward Profile Error:", profileError);
    return NextResponse.json(
      { error: "User profile not found or error fetching it." },
      { status: 403 }
    );
  }

  // RBAC Check: Ensure user role has permission (adjust roles as needed)
  if (!["Owner", "Worker"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions." },
      { status: 403 }
    );
  }

  const organizationId = profile.organization_id;

  // 2. Validate Request Body
  const body = await request.json();
  const validation = moveForwardSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: validation.error.format() },
      { status: 400 }
    );
  }

  const { items, target_stage_id, source_stage_id } = validation.data;

  try {
    // Fetch workflow configuration for the organization once
    const { data: workflowStagesData, error: workflowError } = await supabase
      .from("workflow_stages")
      .select(
        `
            id,
            sequence_order,
            sub_stages:workflow_sub_stages ( id, sequence_order )
        `
      )
      .eq("organization_id", organizationId)
      .order("sequence_order", { ascending: true })
      .order("sequence_order", {
        foreignTable: "workflow_sub_stages",
        ascending: true,
      });

    if (workflowError || !workflowStagesData) {
      console.error("Move Forward Workflow Fetch Error:", workflowError);
      return NextResponse.json(
        { error: "Failed to fetch workflow configuration." },
        { status: 500 }
      );
    }

    // Ensure sub_stages is always an array and cast to the expected type
    const workflowStages: WorkflowStage[] = workflowStagesData.map((stage) => ({
      ...stage,
      sub_stages: stage.sub_stages || [],
    }));

    // --- Transaction Start ---
    // Note: Supabase JS client doesn't have built-in transactions across multiple awaits easily.
    // We'll perform operations sequentially. For true atomicity, a db function/Edge Function might be better.
    // Consider this a pseudo-transaction; if one fails, prior successful ones aren't rolled back automatically here.

    const results = [];
    const errors = [];

    for (const item of items) {
      const itemId = item.id;
      const requestedQuantity = item.quantity;

      // Fetch current item allocation state - REVISED LOGIC
      let currentAllocation: {
        id: string;
        stage_id: string;
        sub_stage_id: string | null;
        quantity: number;
        organization_id: string;
        // Add stage for sorting if populated
        stage?: WorkflowStage;
      } | null = null;
      let fetchError: { message: string } | null = null;

      if (target_stage_id) {
        const targetStageInWorkflow = workflowStages.find(
          (s) => s.id === target_stage_id
        );
        if (!targetStageInWorkflow) {
          errors.push({
            itemId,
            error: `Target stage ID ${target_stage_id} not found in workflow.`,
          });
          continue;
        }

        const {
          data: potentialSourceAllocations,
          error: potentialSourceError,
        } = await supabase
          .from("item_stage_allocations")
          .select("id, stage_id, sub_stage_id, quantity, organization_id")
          .eq("item_id", itemId)
          .eq("organization_id", organizationId);

        if (potentialSourceError) {
          fetchError = potentialSourceError;
        } else if (
          !potentialSourceAllocations ||
          potentialSourceAllocations.length === 0
        ) {
          fetchError = { message: "No allocations found for item." };
        } else {
          const validSourceAllocations = potentialSourceAllocations
            .map((alloc) => {
              const stageDetails = workflowStages.find(
                (s) => s.id === alloc.stage_id
              );
              return { ...alloc, stage: stageDetails };
            })
            .filter(
              (alloc) =>
                alloc.stage &&
                alloc.stage.sequence_order <
                  targetStageInWorkflow.sequence_order &&
                alloc.quantity >= requestedQuantity
            );

          if (validSourceAllocations.length === 0) {
            // Check for a more specific reason for failure
            const anyBeforeAllocations = potentialSourceAllocations.some(
              (alloc) => {
                const stageDetails = workflowStages.find(
                  (s) => s.id === alloc.stage_id
                );
                return (
                  stageDetails &&
                  stageDetails.sequence_order <
                    targetStageInWorkflow.sequence_order
                );
              }
            );
            if (anyBeforeAllocations) {
              fetchError = {
                message: `Sufficient quantity (${requestedQuantity}) not found in any single allocation before target stage ${target_stage_id}.`,
              };
            } else {
              fetchError = {
                message: `No allocation for item ${itemId} found in a stage before target stage ${target_stage_id}.`,
              };
            }
          } else {
            // If source_stage_id is provided, prioritize allocations from that stage
            if (source_stage_id) {
              const preferredSourceAllocation = validSourceAllocations.find(
                (alloc) => alloc.stage_id === source_stage_id
              );
              if (preferredSourceAllocation) {
                currentAllocation = preferredSourceAllocation;
              } else {
                // Fallback to closest to target if preferred source not found
                validSourceAllocations.sort(
                  (a, b) => b.stage!.sequence_order - a.stage!.sequence_order
                );
                currentAllocation = validSourceAllocations[0];
              }
            } else {
              // Original logic: Sort by stage sequence_order (ascending) to pick the earliest stage
              // This is more intuitive - move from the earliest stage first
              validSourceAllocations.sort(
                (a, b) => a.stage!.sequence_order - b.stage!.sequence_order
              );
              currentAllocation = validSourceAllocations[0];
            }
          }
        }
      } else {
        // Original logic: no target_stage_id, so get the latest allocation overall
        const { data: latestAlloc, error: latestAllocError } = await supabase
          .from("item_stage_allocations")
          .select("id, stage_id, sub_stage_id, quantity, organization_id")
          .eq("item_id", itemId)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        currentAllocation = latestAlloc;
        fetchError = latestAllocError;
      }

      // Consolidated error handling for allocation fetching/selection
      if (fetchError || !currentAllocation) {
        console.warn(
          `Move Forward: Allocation for item ${itemId} not found or error. Target: ${target_stage_id || "next"}. Error:`,
          fetchError?.message
        );
        errors.push({
          itemId,
          error: `Could not retrieve a suitable source allocation for item. ${fetchError?.message || "Item not found or not in a movable state."}`,
        });
        continue;
      }

      let nextLocation: { stageId: string; subStageId: string | null } | null =
        null;

      // --- Determine Target Location --- //
      if (target_stage_id) {
        // Validate the target_stage_id
        const currentStageIndex = workflowStages.findIndex(
          (s) => s.id === currentAllocation.stage_id
        );
        const targetStageIndex = workflowStages.findIndex(
          (s) => s.id === target_stage_id
        );

        if (targetStageIndex === -1) {
          errors.push({
            itemId,
            error: `Target stage ID ${target_stage_id} not found in workflow.`,
          });
          continue;
        }

        if (currentStageIndex === -1) {
          // This should be unlikely if currentAllocation.stage_id is valid
          errors.push({
            itemId,
            error: `Current stage ID ${currentAllocation.stage_id} (from allocation) not found in workflow.`,
          });
          continue;
        }

        // Compare sequence_order instead of array indices
        const currentStage = workflowStages[currentStageIndex];
        const targetStage = workflowStages[targetStageIndex];

        // console.log("Debug - Current Stage:", {
        //   id: currentStage.id,
        //   sequence_order: currentStage.sequence_order,
        //   index: currentStageIndex,
        // });
        // console.log("Debug - Target Stage:", {
        //   id: targetStage.id,
        //   sequence_order: targetStage.sequence_order,
        //   index: targetStageIndex,
        // });
        // console.log(
        //   "Debug - All Stages:",
        //   workflowStages.map((s, i) => ({
        //     id: s.id,
        //     sequence_order: s.sequence_order,
        //     index: i,
        //   }))
        // );

        // Check if the stages are the same
        if (currentStage.id === targetStage.id) {
          errors.push({
            itemId,
            error: `Cannot move to the same stage (${currentStage.id}).`,
          });
          continue;
        }

        // Compare sequence orders
        if (targetStage.sequence_order <= currentStage.sequence_order) {
          errors.push({
            itemId,
            error: `Target stage ${target_stage_id} (sequence: ${targetStage.sequence_order}) is not after the current stage ${currentAllocation.stage_id} (sequence: ${currentStage.sequence_order}).`,
          });
          continue;
        }

        // Target is valid, determine its first sub-stage (if any)
        const targetSubStages = targetStage.sub_stages ?? [];
        const nextSubStageId =
          targetSubStages.length > 0 ? targetSubStages[0].id : null;

        nextLocation = {
          stageId: target_stage_id,
          subStageId: nextSubStageId,
        };
      } else {
        // No target_stage_id provided, use the default next stage logic
        nextLocation = determineNextStage(
          currentAllocation.stage_id,
          currentAllocation.sub_stage_id,
          workflowStages // Use the formatted workflow stages
        );
      }
      // --- End Determine Target Location --- //

      if (!nextLocation) {
        errors.push({
          itemId,
          error:
            "Cannot determine next stage (possibly already at the end or workflow misconfiguration).",
        });
        continue;
      }

      const timestamp = new Date().toISOString();

      // This check is a placeholder for more complex logic
      if (requestedQuantity > currentAllocation.quantity) {
        errors.push({
          itemId,
          error: `Requested quantity (${requestedQuantity}) exceeds available quantity (${currentAllocation.quantity}) in the selected source allocation.`,
        });
        continue;
      }

      // Add debug logging for quantities
      console.log("Debug - Item Quantities:", {
        itemId,
        requestedQuantity,
        currentAllocationQuantity: currentAllocation.quantity,
        currentAllocationId: currentAllocation.id,
      });

      // --- Handle the source allocation ---
      if (requestedQuantity === currentAllocation.quantity) {
        // FULL MOVE from source: Delete the source allocation as its entire quantity is moving.
        const { error: deleteSourceError } = await supabase
          .from("item_stage_allocations")
          .delete()
          .eq("id", currentAllocation.id);

        if (deleteSourceError) {
          console.error(
            `Move Forward: Error deleting source allocation ${currentAllocation.id} for item ${itemId} during full move.`,
            deleteSourceError
          );
          errors.push({
            itemId,
            error: `Failed to remove source item allocation for full move. ${deleteSourceError.message}`,
          });
          continue;
        }
      } else {
        // PARTIAL MOVE from source: Reduce quantity of the current (source) allocation.
        const { error: existingAllocationUpdateError } = await supabase
          .from("item_stage_allocations")
          .update({
            quantity: currentAllocation.quantity - requestedQuantity,
            updated_at: timestamp,
            // moved_by for the source update is usually not set, only for the target.
          })
          .eq("id", currentAllocation.id);

        if (existingAllocationUpdateError) {
          console.error(
            `Move Forward: Error reducing quantity for existing allocation ${currentAllocation.id} for item ${itemId}`,
            existingAllocationUpdateError
          );
          errors.push({
            itemId,
            error: `Failed to update existing item allocation (partial move). ${existingAllocationUpdateError.message}`,
          });
          continue;
        }
      }

      // --- Handle the target allocation (consolidate or create new) ---
      // This logic is now common for both full moves from a source and partial moves.

      let targetAllocationQuery = supabase
        .from("item_stage_allocations")
        .select("id, quantity")
        .eq("item_id", itemId)
        .eq("organization_id", organizationId)
        .eq("stage_id", nextLocation.stageId);

      if (nextLocation.subStageId === null) {
        targetAllocationQuery = targetAllocationQuery.is("sub_stage_id", null);
      } else {
        targetAllocationQuery = targetAllocationQuery.eq(
          "sub_stage_id",
          nextLocation.subStageId
        );
      }

      const { data: targetAllocation, error: targetAllocationFetchError } =
        await targetAllocationQuery.limit(1).single();

      if (
        targetAllocationFetchError &&
        targetAllocationFetchError.code !== "PGRST116" // PGRST116: single row not found, which is fine here.
      ) {
        console.error(
          `Move Forward: Error checking for existing target allocation for item ${itemId}`,
          targetAllocationFetchError
        );
        errors.push({
          itemId,
          error: `Failed to check for existing target allocation. ${targetAllocationFetchError.message}`,
        });
        // At this point, the source might have been altered. This is a critical state.
        // For a deleted source, it's gone. For a reduced source, it's already updated.
        // Consider how to handle this inconsistency if truly atomic operations are needed (e.g., db function).
        continue;
      }

      if (targetAllocation) {
        // Target allocation exists: Update its quantity
        const { error: targetAllocationUpdateError } = await supabase
          .from("item_stage_allocations")
          .update({
            quantity: targetAllocation.quantity + requestedQuantity,
            updated_at: timestamp,
            moved_by: user.id,
          })
          .eq("id", targetAllocation.id);

        if (targetAllocationUpdateError) {
          console.error(
            `Move Forward: Error updating existing target allocation ${targetAllocation.id} for item ${itemId}`,
            targetAllocationUpdateError
          );
          errors.push({
            itemId,
            error: `DATA INCONSISTENCY: Failed to update target item allocation. Source was modified. ${targetAllocationUpdateError.message}`,
          });
          continue;
        }
      } else {
        // No target allocation exists: Create a new one for the moved quantity
        const newAllocationData = {
          item_id: itemId,
          organization_id: organizationId,
          stage_id: nextLocation.stageId,
          sub_stage_id: nextLocation.subStageId,
          quantity: requestedQuantity,
          created_at: timestamp,
          updated_at: timestamp,
          moved_by: user.id,
          // status: 'In Progress', // Ensure default status is appropriate or set by DB
        };

        const { error: newAllocationInsertError } = await supabase
          .from("item_stage_allocations")
          .insert(newAllocationData);

        if (newAllocationInsertError) {
          console.error(
            `Move Forward: Error inserting new allocation for item ${itemId} at target.`,
            newAllocationInsertError
          );
          errors.push({
            itemId,
            error: `DATA INCONSISTENCY: Failed to create new item allocation for moved part. Source was modified. ${newAllocationInsertError.message}`,
          });
          continue;
        }
      }
      // --- End Logic for target allocation ---

      // Insert new movement history record
      const { error: movementLogInsertError } = await supabase
        .from("item_movement_history")
        .insert({
          item_id: itemId,
          from_stage_id: currentAllocation.stage_id,
          from_sub_stage_id: currentAllocation.sub_stage_id,
          to_stage_id: nextLocation.stageId,
          to_sub_stage_id: nextLocation.subStageId,
          quantity: requestedQuantity, // Log the requested quantity that was moved
          moved_at: timestamp,
          moved_by: user.id,
          organization_id: organizationId,
        });

      if (movementLogInsertError) {
        console.error(
          `Move Forward: Error inserting new movement history for item ${itemId}`,
          movementLogInsertError
        );
        // Critical inconsistency. Log and report error. Consider manual cleanup/alerting.
        // Attempt to rollback allocation update? Difficult without transactions.
        errors.push({
          itemId,
          error: `Failed to log new movement history. Item allocation was updated but movement not logged.`,
        });
        continue; // Stop processing this item
      }

      results.push({
        itemId,
        status: "success",
        nextStageId: nextLocation.stageId,
        nextSubStageId: nextLocation.subStageId,
      });
    }

    // --- Pseudo-Transaction End ---

    if (errors.length > 0) {
      // Partial success or total failure
      return NextResponse.json(
        {
          message: `Processed ${items.length} items. Success: ${results.length}, Failures: ${errors.length}.`,
          results,
          errors,
        },
        { status: errors.length === items.length ? 500 : 207 }
      ); // 207 Multi-Status if partially successful
    }

    return NextResponse.json(
      {
        message: `Successfully moved ${results.length} items.`,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Move Forward Unhandled Error:", error);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
