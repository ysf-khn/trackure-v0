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
    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        // Call the scrap_item_with_replacement database function
        const { data: scrapResult, error: scrapError } = await supabase.rpc(
          "scrap_item_with_replacement",
          {
            p_item_id: item.id,
            p_quantity: item.quantity,
            p_scrap_reason: scrap_reason,
            p_create_replacement: create_replacement,
            p_preserve_total_quantity: preserve_total_quantity,
          }
        );

        if (scrapError) {
          errors.push({
            itemId: item.id,
            error: scrapError.message,
          });
          continue;
        }

        // scrapResult should contain scrapped_item_id, replacement_item_id, message
        const result = scrapResult[0]; // Function returns table
        results.push({
          itemId: item.id,
          scrappedItemId: result.scrapped_item_id,
          replacementItemId: result.replacement_item_id,
          message: result.message,
        });

      } catch (itemError) {
        console.error(`Error scrapping item ${item.id}:`, itemError);
        errors.push({
          itemId: item.id,
          error: `Failed to scrap item: ${itemError.message}`,
        });
      }
    }

    // Determine response status
    const status = errors.length === 0 ? 200 : 
                  results.length === 0 ? 500 : 207; // Multi-status

    // Format response
    const response = {
      message: `Processed ${items.length} items for scrapping. Success: ${results.length}, Failures: ${errors.length}.`,
      results,
      ...(errors.length > 0 && { errors }),
    };

    return NextResponse.json(response, { status });

  } catch (error) {
    console.error("Scrap Items Unhandled Error:", error);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}

// GET endpoint to check if items can be scrapped
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const itemIds = searchParams.get('item_ids')?.split(',') || [];

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
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select(`
        id,
        sku,
        total_quantity,
        is_scrapped,
        order_id,
        allocations:item_stage_allocations(
          id,
          quantity,
          stage:workflow_stages(name, full_path)
        )
      `)
      .in("id", itemIds);

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to fetch items" },
        { status: 500 }
      );
    }

    const scrapableItems = items.map(item => ({
      id: item.id,
      sku: item.sku,
      total_quantity: item.total_quantity,
      is_scrapped: item.is_scrapped,
      can_scrap: !item.is_scrapped && item.allocations && item.allocations.length > 0,
      current_stage: item.allocations?.[0]?.stage?.name || 'Unknown',
      allocated_quantity: item.allocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0,
      scrap_reason_required: true,
      can_create_replacement: !item.is_scrapped,
    }));

    return NextResponse.json({
      items: scrapableItems,
      summary: {
        total_items: items.length,
        scrapable_items: scrapableItems.filter(i => i.can_scrap).length,
        already_scrapped: scrapableItems.filter(i => i.is_scrapped).length,
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