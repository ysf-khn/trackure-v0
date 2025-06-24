import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { type SupabaseClient } from "@supabase/supabase-js";
import { canAddItems } from "@/lib/plan-limits";

// Zod schema for component instance details
const componentInstanceDetailsSchema = z
  .object({
    weight: z.number().optional(),
    size: z.string().optional(),
    net_weight: z.number().optional(),
    gross_weight: z.number().optional(),
  })
  .optional();

// Zod schema for components
const componentSchema = z.object({
  component_sku: z.string().min(1, "Component SKU is required"),
  quantity_per_composite: z
    .number()
    .min(1, "Quantity must be at least 1")
    .default(1),
  instance_details: componentInstanceDetailsSchema,
});

// Zod schema for instance details (matching frontend structure, but parsing numbers)
const instanceDetailsSchema = z
  .object({
    weight: z.number().optional(),
    size: z.string().optional(),
    box_size: z.string().optional(), // Match DB naming
    buyer_id: z.string().optional(), // New field for buyer ID
    total_quantity: z.number().optional().nullable(), // New field for total quantity
    // Add other fields as needed
  })
  .passthrough(); // Allow extra fields if necessary

// Zod schema for the request body
const addItemSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  is_composite: z.boolean().default(false), // New field for inline composite creation
  components: z.array(componentSchema).optional(), // Components for composite items
  instance_details: instanceDetailsSchema.optional(),
});

// Helper function to get the first workflow stage/sub-stage
async function getFirstWorkflowStep(
  supabase: SupabaseClient<any, "public", any>,
  orgId: string
): Promise<{ stageId: string | null; subStageId: string | null }> {
  let firstStage: { id: string } | null = null;

  // 1. Try fetching the first organization-specific stage
  const { data: orgStages, error: orgStageError } = await supabase
    .from("workflow_stages")
    .select("id, sequence_order")
    .eq("organization_id", orgId)
    .order("sequence_order", { ascending: true })
    .limit(1);

  if (orgStageError) {
    console.error("Error fetching org-specific stages:", orgStageError);
    // Decide if we should proceed or error out - for now, we proceed to check defaults
  }

  if (orgStages && orgStages.length > 0) {
    firstStage = orgStages[0];
  } else {
    // 2. If no org-specific stage, fetch the first default stage

    const { data: defaultStages, error: defaultStageError } = await supabase
      .from("workflow_stages")
      .select("id, sequence_order")
      .is("organization_id", null) // Default stages have null orgId
      .eq("is_default", true)
      .order("sequence_order", { ascending: true })
      .limit(1);

    if (defaultStageError) {
      console.error("Error fetching default stages:", defaultStageError);
      // If both org and default fetch failed, return null
      return { stageId: null, subStageId: null };
    }

    if (defaultStages && defaultStages.length > 0) {
      firstStage = defaultStages[0];
    } else {
      // No org-specific stages and no default stages found
      console.error(
        `Error fetching first stage: No stages found for org ${orgId} and no defaults found.`
      );
      return { stageId: null, subStageId: null };
    }
  }

  // We found a first stage (either org-specific or default)
  const firstStageId = firstStage?.id;
  let firstSubStageId: string | null = null;

  // 3. Try fetching the first organization-specific sub-stage for this stage
  const { data: orgSubStages, error: orgSubStageError } = await supabase
    .from("workflow_sub_stages")
    .select("id, sequence_order")
    .eq("stage_id", firstStageId)
    .eq("organization_id", orgId) // Look for org-specific sub-stage
    .order("sequence_order", { ascending: true })
    .limit(1);

  if (orgSubStageError) {
    console.error(
      `Error fetching org-specific sub-stages for stage ${firstStageId}:`,
      orgSubStageError
    );
  }

  if (orgSubStages && orgSubStages.length > 0) {
    firstSubStageId = orgSubStages[0].id;
  } else {
    // 4. If no org-specific sub-stage, fetch the first default sub-stage for this stage
    const { data: defaultSubStages, error: defaultSubStageError } =
      await supabase
        .from("workflow_sub_stages")
        .select("id, sequence_order")
        .eq("stage_id", firstStageId)
        .is("organization_id", null) // Default sub-stages have null orgId
        .eq("is_default", true)
        .order("sequence_order", { ascending: true })
        .limit(1);

    if (defaultSubStageError) {
      console.error(
        `Error fetching default sub-stages for stage ${firstStageId}:`,
        defaultSubStageError
      );
      // Proceed with stage ID but null sub-stage ID if default fetch fails
    }

    if (defaultSubStages && defaultSubStages.length > 0) {
      firstSubStageId = defaultSubStages[0].id;
    }
    // If no org-specific and no default sub-stages, firstSubStageId remains null
  }

  return { stageId: firstStageId ?? null, subStageId: firstSubStageId };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { orderId } = await params;

  // Get user session from Supabase
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Fetch Profile to get Organization ID and Role ---
  const userId = user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role") // Fetch role as well for RBAC
    .eq("id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      `Error fetching profile or missing organization_id for user ${userId}:`,
      profileError?.message
    );
    return NextResponse.json(
      {
        error:
          profileError?.message ||
          "Unauthorized: User profile or organization mapping not found.",
      },
      { status: 401 }
    );
  }
  const orgId = profile.organization_id;
  const userRole = profile.role;
  // --- End Profile Fetch ---

  // RBAC Check using role from profiles table
  if (userRole === "Worker") {
    // Check if worker has permission to add items
    const { data: hasPermission, error: permissionError } = await supabase.rpc(
      "worker_has_permission",
      {
        permission_key: "items.add",
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
        { error: "Forbidden: You don't have permission to add items" },
        { status: 403 }
      );
    }
  } else if (!userRole || !["Owner", "Worker"].includes(userRole)) {
    console.warn(`User ${userId} with role ${userRole} attempted to add item.`);
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // Validate body using Zod schema
    const validation = addItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }
    const { sku, is_composite, components, instance_details } = validation.data;

    // Check plan limits before creating the item
    const itemQuantity = instance_details?.total_quantity || 1;
    const limitCheck = await canAddItems(orgId, userId, itemQuantity);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 402 } // Payment Required - plan limit exceeded
      );
    }

    // --- Database Logic ---
    // Note: Consider using a Supabase Edge Function with pg_transaction for true atomicity.
    // This sequential approach has potential for partial failure.

    // 1. Check if item_master exists for orgId + sku and if it's a composite item
    const { data: masterItem, error: masterCheckError } = await supabase
      .from("item_master")
      .select("sku, is_composite")
      .eq("organization_id", orgId)
      .eq("sku", sku)
      .maybeSingle();

    if (masterCheckError) {
      console.error("Error checking item_master:", masterCheckError);
      throw new Error("Failed to check item master data.");
    }

    // 2. If not exists, INSERT into item_master
    if (!masterItem) {
      const { error: masterInsertError } = await supabase
        .from("item_master")
        .insert({
          organization_id: orgId,
          sku: sku,
          // Use instance_details as master_details for the new entry
          // This assumes the structure is acceptable for master details.
          // May need refinement based on requirements.
          master_details: instance_details || {},
          is_composite: is_composite, // Set composite flag based on request
        });

      if (masterInsertError) {
        console.error("Error inserting item_master:", masterInsertError);
        // Check for unique constraint violation (race condition)
        if (masterInsertError.code === "23505") {
          return NextResponse.json(
            {
              error:
                "Failed to create item master due to conflict. Please try again.",
            },
            { status: 409 }
          );
        }
        throw new Error("Failed to create new item master record.");
      }
    } else if (is_composite && !masterItem.is_composite) {
      // Update existing item to mark as composite
      const { error: updateMasterError } = await supabase
        .from("item_master")
        .update({ is_composite: true })
        .eq("organization_id", orgId)
        .eq("sku", sku);

      if (updateMasterError) {
        console.error(
          "Error updating item_master to composite:",
          updateMasterError
        );
        throw new Error("Failed to update item master to composite.");
      }
    }

    // 3. Handle composite item creation - either existing or inline
    const isComposite = is_composite || masterItem?.is_composite || false;

    if (isComposite) {
      // Handle inline composite creation
      if (is_composite && components && components.length > 0) {
        // Create or update composite item definition
        const { data: existingComposite, error: compositeCheckError } =
          await supabase
            .from("composite_item_definitions")
            .select("id")
            .eq("composite_sku", sku)
            .eq("organization_id", orgId)
            .maybeSingle();

        if (compositeCheckError) {
          console.error(
            "Error checking composite definition:",
            compositeCheckError
          );
          throw new Error("Failed to check composite definition.");
        }

        let compositeDefinitionId: string;

        if (!existingComposite) {
          // Create new composite definition
          const { data: newComposite, error: createCompositeError } =
            await supabase
              .from("composite_item_definitions")
              .insert({
                composite_sku: sku,
                organization_id: orgId,
                name: `Composite Item: ${sku}`,
                description: "Created inline during order",
                is_active: true,
              })
              .select("id")
              .single();

          if (createCompositeError || !newComposite) {
            console.error(
              "Error creating composite definition:",
              createCompositeError
            );
            throw new Error("Failed to create composite definition.");
          }

          compositeDefinitionId = newComposite.id;
        } else {
          compositeDefinitionId = existingComposite.id;

          // Clear existing components for this definition
          const { error: deleteComponentsError } = await supabase
            .from("composite_item_components")
            .delete()
            .eq("composite_definition_id", compositeDefinitionId);

          if (deleteComponentsError) {
            console.error(
              "Error clearing existing components:",
              deleteComponentsError
            );
            throw new Error("Failed to clear existing components.");
          }
        }

        // First, ensure component SKUs exist in item_master BEFORE creating composite components
        for (const component of components) {
          const { error: componentMasterError } = await supabase
            .from("item_master")
            .upsert(
              {
                organization_id: orgId,
                sku: component.component_sku,
                master_details: {},
                is_composite: false,
              },
              {
                onConflict: "organization_id,sku",
                ignoreDuplicates: true,
              }
            );

          if (componentMasterError) {
            console.error(
              `Error ensuring component SKU ${component.component_sku} in item_master:`,
              componentMasterError
            );
            throw new Error(
              `Failed to create/update component SKU ${component.component_sku} in item master.`
            );
          }
        }

        // Now create/update components (after ensuring SKUs exist in item_master)
        const componentInserts = components.map((component) => ({
          composite_definition_id: compositeDefinitionId,
          component_sku: component.component_sku,
          organization_id: orgId,
          quantity_per_composite: component.quantity_per_composite,
        }));

        const { error: componentInsertError } = await supabase
          .from("composite_item_components")
          .insert(componentInserts);

        if (componentInsertError) {
          console.error("Error inserting components:", componentInsertError);
          throw new Error("Failed to create composite components.");
        }
      }

      // Create component items individually or using database function
      const compositeQuantity = instance_details?.total_quantity || 1;

      // Check if any components have individual instance details
      const hasComponentDetails =
        components &&
        components.some(
          (component) =>
            component.instance_details &&
            Object.keys(component.instance_details).length > 0
        );

      let compositeGroupId: string;

      if (hasComponentDetails && components) {
        // Create component items individually with their specific instance details
        compositeGroupId = crypto.randomUUID();

        // Get the first workflow stage for new items
        const { stageId: firstStageId, subStageId: firstSubStageId } =
          await getFirstWorkflowStep(supabase, orgId);

        if (!firstStageId) {
          throw new Error("Workflow configuration incomplete or missing.");
        }

        for (const component of components) {
          const componentTotalQuantity =
            component.quantity_per_composite * compositeQuantity;

          // Merge component instance details with main instance details (component details take precedence)
          const mergedInstanceDetails = {
            ...(instance_details || {}),
            ...(component.instance_details || {}),
          };

          // Create the component item
          const { data: componentItem, error: componentItemError } =
            await supabase
              .from("items")
              .insert({
                order_id: orderId,
                sku: component.component_sku,
                buyer_id: instance_details?.buyer_id,
                instance_details: mergedInstanceDetails,
                total_quantity: componentTotalQuantity,
                remaining_quantity: componentTotalQuantity,
                organization_id: orgId,
                composite_group_id: compositeGroupId,
                parent_composite_sku: sku,
                status: "New",
              })
              .select("id")
              .single();

          if (componentItemError || !componentItem) {
            console.error(
              `Error creating component item ${component.component_sku}:`,
              componentItemError
            );
            throw new Error(
              `Failed to create component item ${component.component_sku}.`
            );
          }

          // Create movement history for the component item
          const { error: movementError } = await supabase
            .from("item_movement_history")
            .insert({
              item_id: componentItem.id,
              from_stage_id: null,
              from_sub_stage_id: null,
              to_stage_id: firstStageId,
              to_sub_stage_id: firstSubStageId,
              quantity: componentTotalQuantity,
              moved_at: new Date().toISOString(),
              moved_by: userId,
              organization_id: orgId,
            });

          if (movementError) {
            console.error(
              `Error creating movement history for component item ${component.component_sku}:`,
              movementError
            );
            // Log error but don't fail the whole request
          }
        }
      } else {
        // Use existing database function for backward compatibility
        const { data: groupId, error: compositeError } = await supabase.rpc(
          "create_composite_item_components",
          {
            p_order_id: orderId,
            p_composite_sku: sku,
            p_composite_quantity: compositeQuantity,
            p_organization_id: orgId,
            p_buyer_id: instance_details?.buyer_id || null,
            p_instance_details: instance_details || null,
          }
        );

        if (compositeError) {
          console.error(
            "Error creating composite item components:",
            compositeError
          );
          throw new Error("Failed to create composite item components.");
        }

        compositeGroupId = groupId;
      }

      return NextResponse.json(
        {
          message: "Composite item added successfully",
          composite_group_id: compositeGroupId,
          type: "composite",
        },
        { status: 201 }
      );
    }

    // 4. Get the first workflow stage/sub-stage ID for the orgId (for regular items)
    const { stageId: firstStageId, subStageId: firstSubStageId } =
      await getFirstWorkflowStep(supabase, orgId);

    if (!firstStageId) {
      console.error(
        `No initial workflow stage found for organization ${orgId}`
      );
      throw new Error("Workflow configuration incomplete or missing.");
    }

    // 5. INSERT into items table (for regular items only)
    const { data: newItem, error: itemInsertError } = await supabase
      .from("items")
      .insert({
        order_id: orderId,
        organization_id: orgId,
        sku: sku,
        instance_details: instance_details || {},
        buyer_id: instance_details?.buyer_id,
        total_quantity: instance_details?.total_quantity,
        remaining_quantity: instance_details?.total_quantity,
        // current_stage_id: firstStageId,
        // current_sub_stage_id: firstSubStageId,
        // created_by: userId,
      })
      .select("id, total_quantity") // Select the ID and total_quantity of the newly created item
      .single();

    if (itemInsertError || !newItem) {
      console.error("Error inserting item:", itemInsertError);
      throw new Error("Failed to add item to the order.");
    }
    // const newItemId = newItem.id; // newItem now contains id and total_quantity

    // 6. INSERT into item_movement_history for the initial creation (for regular items only)
    const { error: movementHistoryInsertError } = await supabase
      .from("item_movement_history")
      .insert({
        item_id: newItem.id,
        from_stage_id: null, // Initial entry, no 'from' stage
        from_sub_stage_id: null, // Initial entry, no 'from' sub-stage
        to_stage_id: firstStageId,
        to_sub_stage_id: firstSubStageId,
        quantity: newItem.total_quantity, // Quantity of the item created
        moved_at: new Date().toISOString(),
        moved_by: userId, // User who performed the action (creation)
        organization_id: orgId,
        // rework_reason is omitted, defaults to null
      });

    if (movementHistoryInsertError) {
      // This is problematic as the item exists but movement history tracking failed.
      // Log error, but maybe don't fail the whole request?
      // Alternatively, attempt to delete the item created in step 4 for consistency.
      console.error(
        `Error inserting item_movement_history for item ${newItem.id}:`,
        movementHistoryInsertError
      );
      // Consider returning success but logging the history failure
      // return NextResponse.json({ message: 'Item added, but movement history logging failed', itemId: newItem.id }, { status: 207 });
      throw new Error("Failed to record initial item movement history."); // Fail request for now
    }

    return NextResponse.json(
      {
        message: "Item added successfully",
        itemId: newItem.id,
        type: "single",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(
      `Error processing add item request for order ${orderId}:`,
      error
    );
    // Type guard for error message
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
