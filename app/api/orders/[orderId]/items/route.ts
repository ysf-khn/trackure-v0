import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { type SupabaseClient } from "@supabase/supabase-js";

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
    console.log(
      `No org-specific stages found for ${orgId}, checking defaults...`
    );
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
  if (!userRole || !["Owner", "Worker"].includes(userRole)) {
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
    const { sku, instance_details } = validation.data;

    // --- Database Logic ---
    // Note: Consider using a Supabase Edge Function with pg_transaction for true atomicity.
    // This sequential approach has potential for partial failure.

    // 1. Check if item_master exists for orgId + sku
    const { data: masterItem, error: masterCheckError } = await supabase
      .from("item_master")
      .select("sku")
      .eq("organization_id", orgId)
      .eq("sku", sku)
      .maybeSingle();

    if (masterCheckError) {
      console.error("Error checking item_master:", masterCheckError);
      throw new Error("Failed to check item master data.");
    }

    // 2. If not exists, INSERT into item_master
    if (!masterItem) {
      console.log(`Item master for SKU ${sku} not found, creating...`);
      const { error: masterInsertError } = await supabase
        .from("item_master")
        .insert({
          organization_id: orgId,
          sku: sku,
          // Use instance_details as master_details for the new entry
          // This assumes the structure is acceptable for master details.
          // May need refinement based on requirements.
          master_details: instance_details || {},
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
      console.log(`Created new item master for SKU: ${sku}`);
    }

    // 3. Get the first workflow stage/sub-stage ID for the orgId
    const { stageId: firstStageId, subStageId: firstSubStageId } =
      await getFirstWorkflowStep(supabase, orgId);

    if (!firstStageId) {
      console.error(
        `No initial workflow stage found for organization ${orgId}`
      );
      throw new Error("Workflow configuration incomplete or missing.");
    }
    console.log(
      `Determined first step: Stage ${firstStageId}, Sub-stage ${firstSubStageId}`
    );

    // 4. INSERT into items table
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
    console.log(`Inserted new item with ID: ${newItem.id}`);

    // 5. INSERT into item_movement_history for the initial creation
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

    console.log(
      `Inserted initial movement history record for item ${newItem.id}`
    );

    return NextResponse.json(
      { message: "Item added successfully", itemId: newItem.id },
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
