import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Scrap items request schema
const scrapItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("Quantity must be a positive number."),
        stage_id: z
          .string()
          .uuid("Stage ID is required to identify which stage to scrap from."),
      })
    )
    .min(1, "At least one item is required."),
  scrap_reason: z.string().min(1, "Scrap reason is required."),
  create_replacement: z.boolean().default(false),
  preserve_total_quantity: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Scrap Items: Authentication error:", userError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate the request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error("Scrap Items: JSON parsing error:", parseError);
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // Validate the request body against the schema
  const validationResult = scrapItemsSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("Scrap Items: Validation error:", validationResult.error);
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const { items, scrap_reason, create_replacement, preserve_total_quantity } =
    validationResult.data;

  // Fetch user profile to get organization_id and role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Scrap Items Profile Error:", profileError);
    return NextResponse.json(
      { error: "User profile not found or error fetching it." },
      { status: 403 }
    );
  }

  // RBAC Check: Ensure user role has permission
  if (profile.role === "Worker") {
    const { data: hasPermission, error: permissionError } = await supabase.rpc(
      "worker_has_permission",
      {
        permission_key: "items.scrap",
      }
    );

    if (permissionError) {
      console.error("Error checking scrap permissions:", permissionError);
      return NextResponse.json(
        { error: "Failed to verify permissions" },
        { status: 500 }
      );
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to scrap items" },
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
    console.log(
      "[SCRAP DEBUG] Starting scrap process for organization:",
      organizationId
    );
    console.log("[SCRAP DEBUG] Request payload:", {
      items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
      scrap_reason: scrap_reason,
      create_replacement: create_replacement,
      preserve_total_quantity: preserve_total_quantity,
    });

    const results = [];
    const errors = [];

    for (const item of items) {
      console.log(
        `[SCRAP DEBUG] Processing item ${item.id} with quantity ${item.quantity} from stage ${item.stage_id}`
      );

      try {
        // Call the scrap_item_with_replacement database function
        console.log(
          `[SCRAP DEBUG] Calling scrap_item_with_replacement RPC for item ${item.id}`
        );
        const { data: scrapResult, error: scrapError } = await supabase.rpc(
          "scrap_item_with_replacement",
          {
            p_item_id: item.id,
            p_quantity: item.quantity,
            p_scrap_reason: scrap_reason,
            p_stage_id: item.stage_id,
            p_create_replacement: create_replacement,
            p_preserve_total_quantity: preserve_total_quantity,
          }
        );

        console.log(`[SCRAP DEBUG] RPC result for item ${item.id}:`, {
          scrapResult,
          scrapError,
        });

        if (scrapError) {
          console.error(`[SCRAP DEBUG] Database error for item ${item.id}:`, {
            message: scrapError.message,
            details: scrapError.details,
            hint: scrapError.hint,
            code: scrapError.code,
            fullError: scrapError,
          });
          errors.push({
            itemId: item.id,
            error: scrapError.message,
            details: scrapError.details,
            code: scrapError.code,
          });
          continue;
        }

        // Verify the transaction was committed by checking the allocation
        console.log(
          `[SCRAP DEBUG] Verifying transaction completion for item ${item.id}`
        );
        const { data: verificationData, error: verificationError } =
          await supabase
            .from("item_stage_allocations")
            .select("quantity")
            .eq("item_id", item.id)
            .eq("stage_id", item.stage_id)
            .maybeSingle();

        if (verificationError) {
          console.warn(
            `[SCRAP DEBUG] Verification query failed for item ${item.id}:`,
            verificationError
          );
          // Continue anyway as the main operation succeeded
        } else {
          console.log(
            `[SCRAP DEBUG] Post-scrap verification for item ${item.id}:`,
            {
              remainingQuantity:
                verificationData?.quantity || "allocation removed",
              scrapQuantity: item.quantity,
            }
          );
        }

        if (!scrapResult) {
          console.error(`[SCRAP DEBUG] No result returned for item ${item.id}`);
          errors.push({
            itemId: item.id,
            error: "No result returned from scrap function",
          });
          continue;
        }

        // scrapResult should contain scrapped_item_id, replacement_item_id, message
        const result = Array.isArray(scrapResult)
          ? scrapResult[0]
          : scrapResult;
        console.log(
          `[SCRAP DEBUG] Processed result for item ${item.id}:`,
          result
        );

        results.push({
          itemId: item.id,
          scrappedItemId: result.scrapped_item_id,
          replacementItemId: result.replacement_item_id,
          message: result.message,
        });
      } catch (itemError: any) {
        console.error(
          `[SCRAP DEBUG] Exception during item processing ${item.id}:`,
          {
            message: itemError?.message,
            stack: itemError?.stack,
            name: itemError?.name,
            fullError: itemError,
          }
        );
        errors.push({
          itemId: item.id,
          error: `Failed to scrap item: ${itemError?.message || "Unknown error"}`,
          exception: itemError?.name || "Unknown exception",
        });
      }
    }

    console.log("[SCRAP DEBUG] Final processing results:", {
      totalItems: items.length,
      successCount: results.length,
      errorCount: errors.length,
      results: results.map((r) => ({ itemId: r.itemId, message: r.message })),
      errors: errors,
    });

    // Determine response status
    const status = errors.length === 0 ? 200 : results.length === 0 ? 500 : 207; // Multi-status

    // Format response
    const response = {
      message: `Processed ${items.length} items for scrapping. Success: ${results.length}, Failures: ${errors.length}.`,
      results,
      ...(errors.length > 0 && { errors }),
    };

    console.log(
      `[SCRAP DEBUG] Returning response with status ${status}:`,
      response
    );
    return NextResponse.json(response, { status });
  } catch (error: any) {
    console.error("[SCRAP DEBUG] Unhandled exception in scrap route:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      fullError: error,
    });
    return NextResponse.json(
      {
        error: "An unexpected server error occurred.",
        details: error?.message || "Unknown error",
        type: error?.name || "Unknown exception",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if items can be scrapped
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const itemIds = searchParams.get("item_ids")?.split(",") || [];

  if (itemIds.length === 0) {
    return NextResponse.json(
      { error: "item_ids parameter is required" },
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

  try {
    // Get items details
    //CHECK FIX IN 22
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select(
        `
        id,
        sku,
        total_quantity,
        is_scrapped,
        order_id,
        allocations:item_stage_allocations(
          id,
          quantity,
          
          stage:workflow_stages(name)
        )
      `
      )
      .in("id", itemIds);

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to fetch items" },
        { status: 500 }
      );
    }

    const scrapableItems = items.map((item) => ({
      id: item.id,
      sku: item.sku,
      total_quantity: item.total_quantity,
      is_scrapped: item.is_scrapped,
      can_scrap:
        !item.is_scrapped && item.allocations && item.allocations.length > 0,
      //CHECK FIX
      current_stage: item.allocations?.[0]?.stage?.[0]?.name || "Unknown",
      allocated_quantity:
        item.allocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0,
      scrap_reason_required: true,
      can_create_replacement: !item.is_scrapped,
    }));

    return NextResponse.json({
      items: scrapableItems,
      summary: {
        total_items: items.length,
        scrapable_items: scrapableItems.filter((i) => i.can_scrap).length,
        already_scrapped: scrapableItems.filter((i) => i.is_scrapped).length,
      },
    });
  } catch (error) {
    console.error("Scrap Items GET Error:", error);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
