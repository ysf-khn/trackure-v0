import { determinePreviousStage, WorkflowStage } from "@/lib/workflow-utils";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

// Zod schema for input validation - Updated for items with quantity
const reworkInputSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("Quantity must be a positive number."),
        source_stage_id: z.string().uuid("Invalid source stage ID."),
        allocation_type: z.enum(["normal", "reworked"]).optional(), // User can specify allocation type to rework from
      })
    )
    .min(1, "At least one item is required."),
  rework_reason: z
    .string()
    .min(3, "Rework reason must be at least 3 characters long.")
    .max(255, "Rework reason must be at most 255 characters long."),
  target_rework_stage_id: z.string().uuid("Invalid target stage ID."),
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
  if (userRole === "Worker") {
    // Check if worker has permission to move items (rework is a move operation)
    const { data: hasPermission, error: permissionError } = await supabase.rpc(
      "worker_has_permission",
      {
        permission_key: "items.move",
      }
    );

    if (permissionError) {
      console.error("Error checking permissions:", permissionError);
      return NextResponse.json(
        { error: "Failed to verify permissions" },
        { status: 500 }
      );
    }

    if (!hasPermission) {
      return NextResponse.json(
        {
          error:
            "Forbidden: You don't have permission to perform rework operations",
        },
        { status: 403 }
      );
    }
  } else if (!["Owner", "Worker"].includes(userRole)) {
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
  } = parseResult.data;

  try {
    // First, get the SKU of the first item to determine the workflow
    const firstItemId = itemsToRework[0]?.id;
    let itemSKU: string | null = null;
    
    if (firstItemId) {
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("sku")
        .eq("id", firstItemId)
        .single();
      
      if (!itemError && itemData) {
        itemSKU = itemData.sku;
      }
    }

    // Fetch workflow configuration using the new tree structure
    // Filter by SKU if available, otherwise get organization default
    let workflowQuery = supabase
      .from("workflow_stages")
      .select(`
        id,
        name,
        sequence_order,
        location,
        parent_stage_id,
        depth_level,
        full_path,
        is_leaf_stage,
        sku
      `)
      .eq("organization_id", organizationId)
      .order("sequence_order", { ascending: true });

    if (itemSKU) {
      workflowQuery = workflowQuery.eq("sku", itemSKU);
    } else {
      workflowQuery = workflowQuery.is("sku", null);
    }

    const { data: workflowStagesData, error: workflowError } = await workflowQuery;

    if (workflowError || !workflowStagesData) {
      console.error("Rework API Workflow Fetch Error:", workflowError);
      return NextResponse.json(
        { error: "Failed to fetch workflow configuration." },
        { status: 500 }
      );
    }

    // Build tree structure from flat data
    const buildTree = (stages: any[], parentId: string | null = null): FetchedWorkflowStage[] => {
      return stages
        .filter(stage => stage.parent_stage_id === parentId)
        .map(stage => ({
          ...stage,
          children: buildTree(stages, stage.id)
        }))
        .sort((a, b) => a.sequence_order - b.sequence_order);
    };

    const workflowStages: FetchedWorkflowStage[] = buildTree(workflowStagesData);

    // Helper function to find a stage anywhere in the tree structure
    const findStageInTree = (stages: FetchedWorkflowStage[], targetId: string): FetchedWorkflowStage | undefined => {
      for (const stage of stages) {
        if (stage.id === targetId) {
          return stage;
        }
        if (stage.children && stage.children.length > 0) {
          const found = findStageInTree(stage.children, targetId);
          if (found) return found;
        }
      }
      return undefined;
    };

    // Validate that target stage exists in workflow using tree search
    const targetStage = findStageInTree(workflowStages, target_rework_stage_id);
    if (!targetStage) {
      return NextResponse.json(
        { error: "Invalid target stage: Stage not found in workflow." },
        { status: 400 }
      );
    }

    console.log(`[Rework API] Target stage found:`, {
      id: targetStage.id,
      name: targetStage.name,
      full_path: targetStage.full_path,
      sku: itemSKU
    });

    const results = [];
    const errors = [];
    const timestamp = new Date().toISOString();

    // Process all items using the enhanced_rework_items function
    const reworkItemsPayload = itemsToRework.map(item => ({
      id: item.id,
      quantity: item.quantity,
      rework_type: 'backward',
      target_stage_id: target_rework_stage_id
    }));

    console.log("[Rework API] Processing items using direct client operations (like forward API)");

    // Process items directly using Supabase client operations (no RPC)
    for (const itemInput of itemsToRework) {
        const {
          id: itemId,
          quantity: requestedQuantity,
          source_stage_id,
          allocation_type: specifiedAllocationType,
        } = itemInput;

        try {
          // Start a transaction for each item
          // Get all allocations for this item in the source stage to handle multiple allocation types
          const { data: sourceAllocations, error: allocationError } = await supabase
            .from("item_stage_allocations")
            .select("id, stage_id, quantity, organization_id, allocation_type")
            .eq("item_id", itemId)
            .eq("organization_id", organizationId)
            .eq("stage_id", source_stage_id)
            .order("created_at", { ascending: true }); // Order by creation time instead of type

          // Select source allocation without prioritization
          let currentAllocation = null;
          if (!allocationError && sourceAllocations && sourceAllocations.length > 0) {
            console.log(`[Rework API] Found ${sourceAllocations.length} source allocations:`, 
              sourceAllocations.map(a => ({ id: a.id, type: a.allocation_type, qty: a.quantity })));
            
            // Filter by allocation type if specified
            let candidateAllocations = sourceAllocations;
            if (specifiedAllocationType) {
              candidateAllocations = sourceAllocations.filter(alloc => alloc.allocation_type === specifiedAllocationType);
              console.log(`[Rework API] Filtered to ${specifiedAllocationType} allocations:`, 
                candidateAllocations.map(a => ({ id: a.id, type: a.allocation_type, qty: a.quantity })));
              
              if (candidateAllocations.length === 0) {
                console.log(`[Rework API] No allocations found with type ${specifiedAllocationType}`);
                currentAllocation = null;
              } else {
                // Find first allocation with sufficient quantity from filtered candidates
                currentAllocation = candidateAllocations.find(alloc => alloc.quantity >= requestedQuantity);
                
                // If no allocation has enough quantity, take the largest one from candidates
                if (!currentAllocation) {
                  currentAllocation = candidateAllocations.reduce((max, alloc) => 
                    alloc.quantity > max.quantity ? alloc : max
                  );
                }
              }
            } else {
              // No type specified - use original logic
              // Find first allocation with sufficient quantity (no type prioritization)
              currentAllocation = sourceAllocations.find(alloc => alloc.quantity >= requestedQuantity);
              
              // If no allocation has enough quantity, take the largest one
              if (!currentAllocation) {
                currentAllocation = sourceAllocations.reduce((max, alloc) => 
                  alloc.quantity > max.quantity ? alloc : max
                );
              }
            }
          }

          if (allocationError || !currentAllocation) {
            console.error(`[Rework API] Allocation not found:`, {
              itemId,
              source_stage_id,
              error: allocationError?.message,
              allocationsFound: sourceAllocations?.length || 0,
              allocationTypes: sourceAllocations?.map(a => a.allocation_type) || []
            });
            errors.push({
              itemId,
              error: `No suitable allocation found for item in specified stage. ${allocationError?.message || ""}`,
            });
            continue;
          }

          if (requestedQuantity > currentAllocation.quantity) {
            console.error(`[Rework API] Insufficient quantity:`, {
              itemId,
              requestedQuantity,
              availableQuantity: currentAllocation.quantity
            });
            errors.push({
              itemId,
              error: `Requested rework quantity (${requestedQuantity}) exceeds available quantity (${currentAllocation.quantity}) in stage.`,
            });
            continue;
          }

          console.log(`[Rework API] Found allocation:`, {
            itemId,
            allocationId: currentAllocation.id,
            stageId: currentAllocation.stage_id,
            quantity: currentAllocation.quantity,
            allocation_type: currentAllocation.allocation_type,
            requestedQuantity,
            moveType: requestedQuantity === currentAllocation.quantity ? "FULL_REWORK" : "PARTIAL_REWORK"
          });

          // First, check if target allocation exists with same type as source
          // Preserve allocation type from source (no automatic conversion)
          const sourceAllocationType = currentAllocation.allocation_type;
          const { data: targetAllocations, error: targetAllocationFetchError } = await supabase
            .from("item_stage_allocations")
            .select("id, quantity")
            .eq("item_id", itemId)
            .eq("organization_id", organizationId)
            .eq("stage_id", target_rework_stage_id)
            .eq("allocation_type", "reworked"); // Always look for reworked allocations when reworking

          let targetAllocation = null;
          if (!targetAllocationFetchError && targetAllocations && targetAllocations.length > 0) {
            // If there are multiple allocations of the same type (shouldn't happen but handle it), use the first one
            targetAllocation = targetAllocations[0];
            if (targetAllocations.length > 1) {
              console.warn(`[Rework API] Multiple allocations of type ${sourceAllocationType} found for item ${itemId} in stage ${target_rework_stage_id}, using first one`);
            }
          }

          if (targetAllocationFetchError) {
            errors.push({
              itemId,
              error: `Failed to check for existing target rework allocation. ${targetAllocationFetchError.message}`,
            });
            continue;
          }

          // CRITICAL: Handle source allocation FIRST to prevent over-allocation
          // This prevents the temporary state where total allocations exceed item total_quantity
          if (requestedQuantity === currentAllocation.quantity) {
            console.log(`[Rework API] Processing full rework for item ${itemId}`);
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

          // NOW handle the target allocation (after source is successfully reduced)
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
              console.error("Target update error:", targetUpdateError);
              errors.push({
                itemId,
                error: `Failed to update target rework allocation. ${targetUpdateError.message}`,
              });
              continue;
            }
          } else {
            // No target allocation exists: Create a new one
            // Preserve allocation type from source (no automatic conversion)
            const { error: newInsertError } = await supabase
              .from("item_stage_allocations")
              .insert({
                item_id: itemId,
                organization_id: organizationId,
                stage_id: target_rework_stage_id,
                quantity: requestedQuantity,
                allocation_type: "reworked", // Always create reworked allocations when reworking
                created_at: timestamp,
                updated_at: timestamp,
                moved_by: user.id,
              });

            if (newInsertError) {
              console.error("Target insert error:", newInsertError);
              errors.push({
                itemId,
                error: `Failed to create new allocation for reworked part. ${newInsertError.message}`,
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
              to_stage_id: target_rework_stage_id,
              quantity: requestedQuantity,
              moved_at: timestamp,
              moved_by: user.id,
              organization_id: organizationId,
              rework_type: 'backward', // Use 'backward' to match our display logic
              rework_reason: rework_reason,
            });

          if (movementLogInsertError) {
            console.error("Movement history error:", movementLogInsertError);
            errors.push({
              itemId,
              error: `Failed to log rework movement history. ${movementLogInsertError.message}`,
            });
            continue;
          }

          console.log(`[Rework API] Successfully completed rework for item ${itemId}:`, {
            targetStageId: target_rework_stage_id,
            quantity: requestedQuantity,
            reason: rework_reason
          });

          results.push({
            itemId,
            status: "success",
            reworkedToStageId: target_rework_stage_id,
            quantity: requestedQuantity,
          });

        } catch (itemError) {
          console.error(`[Rework API] Error processing item ${itemId}:`, itemError);
          errors.push({
            itemId,
            error: `Unexpected error processing item: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`,
          });
        }
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
