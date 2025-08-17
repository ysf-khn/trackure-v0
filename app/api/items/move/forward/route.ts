import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { determineNextStage, WorkflowStage } from "@/lib/workflow-utils";
import { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

// Use the specific type from the utils file if needed, or define locally
// type FetchedStage = {
//   id: string;
//   sequence_order: number;
//   children: WorkflowStage[]; // Tree structure
// };

// Define the expected request body schema
const moveForwardSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("Quantity must be a positive number."),
        allocation_id: z.string().uuid().optional(), // User can specify exact allocation to move from
      })
    )
    .min(1, "At least one item is required."),
  target_stage_id: z.string().uuid().optional().nullable(), // Optional target stage
  source_stage_id: z.string().uuid().optional().nullable(), // Optional source stage to prioritize
});

export async function POST(request: Request) {
  // const cookieStore = cookies();
  const supabase = await createClient();

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Move Forward: Authentication error:", userError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate the request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error("Move Forward: JSON parsing error:", parseError);
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // Validate the request body against the schema
  const validationResult = moveForwardSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Move Forward: Validation error:", validationResult.error);
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const { items, target_stage_id, source_stage_id } =
    validationResult.data;

  console.log(`[Move Forward API] Request params:`, {
    items: items.map(i => ({ id: i.id, quantity: i.quantity })),
    target_stage_id,
    source_stage_id
  });

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

  // RBAC Check: Ensure user role has permission
  if (profile.role === "Worker") {
    // Check if worker has permission to move items
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
        { error: "Forbidden: You don't have permission to move items" },
        { status: 403 }
      );
    }
  } else if (!["Owner", "Worker"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions." },
      { status: 403 }
    );
  }

  const organizationId = profile.organization_id;

  try {
    // First, get the SKU of the first item to determine the workflow
    // In a proper implementation, we should handle mixed SKUs differently
    const firstItemId = items[0]?.id;
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
      console.error("Move Forward Workflow Fetch Error:", workflowError);
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

    // Helper function to select allocation without prioritization  
    // Simply finds first allocation with sufficient quantity, or largest available
    const selectAllocationForMovement = (
      allocations: any[],
      requestedQuantity: number,
      specifiedAllocationId?: string
    ): any | null => {
      if (!allocations || allocations.length === 0) return null;
      
      console.log(`[Movement] Selecting from allocations:`, 
        allocations.map(a => ({ id: a.id, type: a.allocation_type, qty: a.quantity })));
      
      // If user specified an allocation ID, use that one
      if (specifiedAllocationId) {
        const specified = allocations.find(alloc => alloc.id === specifiedAllocationId);
        if (specified && specified.quantity >= requestedQuantity) {
          console.log(`[Movement] Using user-specified allocation:`, { id: specified.id, type: specified.allocation_type, qty: specified.quantity });
          return specified;
        } else {
          console.log(`[Movement] Specified allocation not found or insufficient quantity`);
          return null;
        }
      }
      
      // Find first allocation with sufficient quantity (no prioritization)
      let selected = allocations.find(alloc => alloc.quantity >= requestedQuantity);
      
      // If no allocation has enough quantity, take the largest one
      if (!selected) {
        selected = allocations.reduce((max, alloc) => 
          alloc.quantity > max.quantity ? alloc : max
        );
      }
      
      console.log(`[Movement] Selected allocation:`, 
        selected ? { id: selected.id, type: selected.allocation_type, qty: selected.quantity } : null);
      
      return selected;
    };

    // Helper function to determine if source stage comes before target stage in workflow
    const isStageBeforeInWorkflow = (sourceStage: FetchedWorkflowStage, targetStage: FetchedWorkflowStage): boolean => {
      console.log(`[isStageBeforeInWorkflow] Comparing:`, {
        source: { 
          id: sourceStage.id,
          name: sourceStage.name, 
          full_path: sourceStage.full_path, 
          sequence_order: sourceStage.sequence_order,
          depth_level: sourceStage.depth_level
        },
        target: { 
          id: targetStage.id,
          name: targetStage.name, 
          full_path: targetStage.full_path, 
          sequence_order: targetStage.sequence_order,
          depth_level: targetStage.depth_level
        }
      });
      
      // Use the same tree flattening logic as in workflow-utils.ts to get correct ordering
      const allStages: { id: string; sequence_order: number; full_path: string | null; position: number }[] = [];
      
      const flattenTreeForComparison = (stages: FetchedWorkflowStage[], parentPath = "") => {
        stages.forEach(stage => {
          const currentPath = parentPath ? `${parentPath}.${stage.sequence_order}` : stage.sequence_order.toString();
          allStages.push({
            id: stage.id,
            sequence_order: stage.sequence_order,
            full_path: currentPath,
            position: allStages.length
          });
          
          if (stage.children && stage.children.length > 0) {
            flattenTreeForComparison(stage.children, currentPath);
          }
        });
      };
      
      flattenTreeForComparison(workflowStages);
      
      // Sort by full path to get the correct sequence (same logic as workflow-utils.ts)
      allStages.sort((a, b) => {
        const aPath = a.full_path?.split('.').map(Number) || [a.sequence_order];
        const bPath = b.full_path?.split('.').map(Number) || [b.sequence_order];
        
        for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
          const aVal = aPath[i] || 0;
          const bVal = bPath[i] || 0;
          if (aVal !== bVal) return aVal - bVal;
        }
        return 0;
      });
      
      console.log(`[isStageBeforeInWorkflow] Flattened and sorted stages:`, 
        allStages.map(s => ({ id: s.id, path: s.full_path }))
      );
      
      // Find positions of source and target stages
      const sourceIndex = allStages.findIndex(s => s.id === sourceStage.id);
      const targetIndex = allStages.findIndex(s => s.id === targetStage.id);
      
      console.log(`[isStageBeforeInWorkflow] Source index: ${sourceIndex}, Target index: ${targetIndex}`);
      
      if (sourceIndex === -1 || targetIndex === -1) {
        console.log(`[isStageBeforeInWorkflow] Stage not found in flattened tree, using fallback`);
        // Fallback to sequence order comparison
        const result = sourceStage.sequence_order < targetStage.sequence_order;
        console.log(`[isStageBeforeInWorkflow] Using sequence order fallback: ${result}`);
        return result;
      }
      
      const result = sourceIndex < targetIndex;
      console.log(`[isStageBeforeInWorkflow] Tree position comparison result: ${result}`);
      return result;
    };

    // --- Transaction Start ---
    // Note: Supabase JS client doesn't have built-in transactions across multiple awaits easily.
    // We'll perform operations sequentially. For true atomicity, a db function/Edge Function might be better.
    // Consider this a pseudo-transaction; if one fails, prior successful ones aren't rolled back automatically here.

    const results = [];
    const errors = [];

    for (const item of items) {
      const itemId = item.id;
      const requestedQuantity = item.quantity;
      const specifiedAllocationId = item.allocation_id; // Get the user's specified allocation ID

      // Fetch current item allocation state - REVISED LOGIC
      let currentAllocation: {
        id: string;
        stage_id: string;
        quantity: number;
        organization_id: string;
        allocation_type: string;
        // Add stage for sorting if populated
        stage?: WorkflowStage;
      } | null = null;
      let fetchError: { message: string } | null = null;

      if (target_stage_id) {
        // Determine the target stage for validation
        let targetStageForValidation: FetchedWorkflowStage | undefined;

        if (target_stage_id) {
          targetStageForValidation = findStageInTree(workflowStages, target_stage_id);
          if (targetStageForValidation) {
            console.log("Move Forward API - Found stage in tree:", {
              stageId: targetStageForValidation.id,
              stageName: targetStageForValidation.name,
              depthLevel: targetStageForValidation.depth_level,
            });
          } else {
            console.log("Move Forward API - Stage not found in workflow tree!");
          }
        }

        if (!targetStageForValidation) {
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
          .select("id, stage_id, quantity, organization_id, allocation_type")
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
              // Find the stage in the tree structure using the global helper
              const stageDetails = findStageInTree(workflowStages, alloc.stage_id);
              return { ...alloc, stage: stageDetails };
            })
            .filter((alloc) => {
              if (!alloc.stage || alloc.quantity < requestedQuantity) {
                return false;
              }

              // Use tree-aware comparison to check if source comes before target
              const isBefore = isStageBeforeInWorkflow(alloc.stage, targetStageForValidation);
              console.log(`[Move Forward API] Comparing stages - Source: ${alloc.stage.full_path || alloc.stage.name} vs Target: ${targetStageForValidation.full_path || targetStageForValidation.name}, isBefore: ${isBefore}`);
              
              if (isBefore) {
                return true;
              }

              // Allow same stage if it's the exact same stage (shouldn't happen in normal flow)
              if (alloc.stage.id === targetStageForValidation.id) {
                return true;
              }

              return false;
            });

          if (validSourceAllocations.length === 0) {
            // Check for a more specific reason for failure
            const anyBeforeAllocations = potentialSourceAllocations.some(
              (alloc) => {
                const stageDetails = findStageInTree(workflowStages, alloc.stage_id);
                return (
                  stageDetails &&
                  isStageBeforeInWorkflow(stageDetails, targetStageForValidation)
                );
              }
            );

            if (anyBeforeAllocations) {
              fetchError = {
                message: `Sufficient quantity (${requestedQuantity}) not found in any single allocation before target stage ${target_stage_id || targetStageForValidation.id}.`,
              };
            } else {
              fetchError = {
                message: `No allocation for item ${itemId} found in a stage before target stage ${target_stage_id || targetStageForValidation.id}.`,
              };
            }
          } else {
            // Use simplified allocation selection without prioritization
            console.log(`[Move Forward API] Valid source allocations:`, 
              validSourceAllocations.map(a => ({ stage: a.stage?.name, type: a.allocation_type, qty: a.quantity })));
            
            // If source_stage_id is provided, filter to that stage first
            if (source_stage_id) {
              const stageAllocations = validSourceAllocations.filter(
                (alloc) => alloc.stage_id === source_stage_id
              );
              
              if (stageAllocations.length > 0) {
                currentAllocation = selectAllocationForMovement(stageAllocations, requestedQuantity, specifiedAllocationId);
              } else {
                // No allocations in preferred stage
                currentAllocation = null;
              }
            } else {
              // No stage preference - select from any valid allocation
              currentAllocation = selectAllocationForMovement(validSourceAllocations, requestedQuantity, specifiedAllocationId);
            }
          }
        }
      } else {
        // Original logic: no target_stage_id, so get all allocations and pick the best one
        const { data: allAllocations, error: latestAllocError } = await supabase
          .from("item_stage_allocations")
          .select("id, stage_id, quantity, organization_id, allocation_type")
          .eq("item_id", itemId)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });

        if (!latestAllocError && allAllocations && allAllocations.length > 0) {
          // Use simplified selection without prioritization
          currentAllocation = selectAllocationForMovement(allAllocations, requestedQuantity, specifiedAllocationId);
        }
        
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

      let nextLocation: { stageId: string } | null = null;

      // --- Determine Target Location --- //
      if (target_stage_id) {
        // Use the targetStageForValidation that was already found earlier in the allocation logic
        let targetStageForValidation: FetchedWorkflowStage | undefined;
        
        targetStageForValidation = findStageInTree(workflowStages, target_stage_id);

        if (!targetStageForValidation) {
          console.error(`[Move Forward API] Target stage not found:`, {
            target_stage_id,
                    workflowStagesCount: workflowStages.length
          });
          errors.push({
            itemId,
            error: `Target stage ID ${target_stage_id} not found in workflow.`,
          });
          continue;
        }

        console.log(`[Move Forward API] Target stage found:`, {
          id: targetStageForValidation.id,
          name: targetStageForValidation.name,
          full_path: targetStageForValidation.full_path
        });

        // Find the current stage using tree search instead of flat array search
        const currentStage = findStageInTree(workflowStages, currentAllocation.stage_id);

        if (!currentStage) {
          console.error(`[Move Forward API] Current stage not found:`, {
            currentAllocationStageId: currentAllocation.stage_id,
            workflowStagesCount: workflowStages.length
          });
          errors.push({
            itemId,
            error: `Current stage ID ${currentAllocation.stage_id} (from allocation) not found in workflow.`,
          });
          continue;
        }

        console.log(`[Move Forward API] Current stage found:`, {
          id: currentStage.id,
          name: currentStage.name,
          full_path: currentStage.full_path
        });

        // Check if we're trying to move to the same stage and sub-stage
        if (currentStage.id === targetStageForValidation.id) {
          console.warn(`[Move Forward API] Same location validation failed:`, {
            currentStageId: currentStage.id,
            targetStageId: targetStageForValidation.id,
          });
          errors.push({
            itemId,
            error: `Cannot move to the same location (stage: ${currentStage.id}).`,
          });
          continue;
        }

        console.log(`[Move Forward API] About to validate stage order:`, {
          current: { id: currentStage.id, name: currentStage.name },
          target: { id: targetStageForValidation.id, name: targetStageForValidation.name }
        });

        // Use tree-aware comparison for stage validation
        if (isStageBeforeInWorkflow(targetStageForValidation, currentStage)) {
          console.error(`[Move Forward API] Target stage is before current stage:`, {
            targetStage: { id: targetStageForValidation.id, path: targetStageForValidation.full_path },
            currentStage: { id: currentStage.id, path: currentStage.full_path }
          });
          errors.push({
            itemId,
            error: `Target stage ${targetStageForValidation.id} (${targetStageForValidation.full_path || targetStageForValidation.name}) is before the current stage ${currentAllocation.stage_id} (${currentStage.full_path || currentStage.name}).`,
          });
          continue;
        }

        console.log(`[Move Forward API] Stage order validation passed - proceeding to determine final target location`);

        // For tree structure, we don't need complex sub-stage validation
        // since target stage is already validated to be a valid next stage in the workflow
        // The tree structure ensures proper progression

        // Determine the final target location
        let finalTargetStageId: string;

        console.log("Move Forward API - Target location determination:", {
                target_stage_id,
          targetStageForValidation: {
            id: targetStageForValidation.id,
            children: targetStageForValidation.children?.map((s) => ({
              id: s.id,
              sequence_order: s.sequence_order,
            })),
          },
        });

        // In tree structure, each stage is independent
        if (target_stage_id) {
          finalTargetStageId = target_stage_id;
          console.log("Move Forward API - Using target stage:", {
            finalTargetStageId,
          });
        } else {
          finalTargetStageId = targetStageForValidation.id;
          console.log("Move Forward API - Using fallback stage:", {
            finalTargetStageId,
          });
        }

        nextLocation = {
          stageId: finalTargetStageId,
        };

        console.log("Move Forward API - Final nextLocation:", nextLocation);
      } else {
        // No target_stage_id provided, use the default next stage logic
        nextLocation = determineNextStage(
          currentAllocation.stage_id,
          null, // Tree structure doesn't use sub_stage
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
      // Preserve the allocation type from source (no automatic conversion)
      const sourceAllocationType = currentAllocation.allocation_type;

      let targetAllocationQuery = supabase
        .from("item_stage_allocations")
        .select("id, quantity")
        .eq("item_id", itemId)
        .eq("organization_id", organizationId)
        .eq("stage_id", nextLocation.stageId)
        .eq("allocation_type", sourceAllocationType); // Preserve source allocation type

      // Tree structure doesn't use sub_stage_id

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
        // Preserve the allocation type from source (no automatic conversion)
        const newAllocationData = {
          item_id: itemId,
          organization_id: organizationId,
          stage_id: nextLocation.stageId,
          quantity: requestedQuantity,
          allocation_type: sourceAllocationType, // Preserve source allocation type
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
          to_stage_id: nextLocation.stageId,
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
