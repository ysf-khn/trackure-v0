import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Schema for adding price history entry
const priceHistorySchema = z.object({
  stage_id: z.string().uuid("Invalid stage ID"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  price_unit: z
    .enum(["per_piece", "per_kg", "per_dozen", "per_hundred"])
    .default("per_piece"),
  effective_from: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// GET - Get price history for a vendor
export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;
  const { searchParams } = new URL(request.url);

  const sku = searchParams.get("sku");
  const stageId = searchParams.get("stage_id");
  const includeInactive = searchParams.get("include_inactive") === "true";

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let query = supabase
      .from("vendor_price_history")
      .select(
        `
        id,
        vendor_id,
        stage_id,
        sku,
        price,
        currency,
        price_unit,
        effective_from,
        effective_to,
        notes,
        created_at,
        created_by,
        stage:workflow_stages(name, full_path),
        sku_details:item_master(master_details)
      `
      )
      .eq("vendor_id", vendorId)
      .order("effective_from", { ascending: false });

    // Apply filters
    if (sku) {
      query = query.eq("sku", sku);
    }

    if (stageId) {
      query = query.eq("stage_id", stageId);
    }

    if (!includeInactive) {
      query = query.is("effective_to", null);
    }

    const { data: priceHistory, error } = await query;

    if (error) {
      console.error("Error fetching price history:", error);
      return NextResponse.json(
        { error: "Failed to fetch price history" },
        { status: 500 }
      );
    }

    // Group by SKU and stage for better organization
    const groupedHistory = priceHistory.reduce(
      (acc, entry) => {
        const key = `${entry.sku}-${entry.stage_id}`;
        if (!acc[key]) {
          acc[key] = {
            sku: entry.sku,
            sku_name: entry.sku_details?.master_details?.name || entry.sku,
            stage_id: entry.stage_id,
            stage_name: entry.stage?.name,
            stage_path: entry.stage?.full_path,
            current_price: null,
            history: [],
          };
        }

        // If this is the current price (no effective_to date)
        if (!entry.effective_to) {
          acc[key].current_price = {
            price: entry.price,
            currency: entry.currency,
            price_unit: entry.price_unit,
            effective_from: entry.effective_from,
            notes: entry.notes,
          };
        }

        acc[key].history.push({
          id: entry.id,
          price: entry.price,
          currency: entry.currency,
          price_unit: entry.price_unit,
          effective_from: entry.effective_from,
          effective_to: entry.effective_to,
          notes: entry.notes,
          created_at: entry.created_at,
          created_by: "System", // We can't easily join to get the user name
        });

        return acc;
      },
      {} as Record<string, any>
    );

    return NextResponse.json({
      price_history: Object.values(groupedHistory),
      total_entries: priceHistory.length,
    });
  } catch (error) {
    console.error("Price history GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Add a new price (updates vendor_stage_pricing and creates history)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user permissions
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 }
    );
  }

  // Only owners can update pricing
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can update vendor pricing" },
      { status: 403 }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const validationResult = priceHistorySchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const priceData = validationResult.data;

  try {
    // Check if vendor belongs to user's organization
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("organization_id")
      .eq("id", vendorId)
      .single();

    if (vendorError || vendor.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "Vendor not found or access denied" },
        { status: 404 }
      );
    }

    // Check if pricing already exists
    const { data: existingPricing, error: existingError } = await supabase
      .from("vendor_stage_pricing")
      .select("id, price")
      .eq("vendor_id", vendorId)
      .eq("stage_id", priceData.stage_id)
      .eq("sku", priceData.sku)
      .single();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("Error checking existing pricing:", existingError);
      return NextResponse.json(
        { error: "Failed to check existing pricing" },
        { status: 500 }
      );
    }

    // Start a transaction-like operation
    if (existingPricing) {
      // Update existing pricing - the trigger will handle history
      const { error: updateError } = await supabase
        .from("vendor_stage_pricing")
        .update({
          price: priceData.price,
          currency: priceData.currency,
          price_unit: priceData.price_unit,
          notes: priceData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPricing.id);

      if (updateError) {
        console.error("Error updating pricing:", updateError);
        return NextResponse.json(
          { error: "Failed to update pricing" },
          { status: 500 }
        );
      }
    } else {
      // Create new pricing entry
      const { error: insertError } = await supabase
        .from("vendor_stage_pricing")
        .insert({
          vendor_id: vendorId,
          stage_id: priceData.stage_id,
          sku: priceData.sku,
          organization_id: profile.organization_id,
          price: priceData.price,
          currency: priceData.currency,
          price_unit: priceData.price_unit,
          notes: priceData.notes,
          is_active: true,
          created_by: user.id,
        });

      if (insertError) {
        console.error("Error creating pricing:", insertError);
        return NextResponse.json(
          { error: "Failed to create pricing" },
          { status: 500 }
        );
      }

      // Also create initial history entry
      const { error: historyError } = await supabase
        .from("vendor_price_history")
        .insert({
          vendor_id: vendorId,
          stage_id: priceData.stage_id,
          sku: priceData.sku,
          organization_id: profile.organization_id,
          price: priceData.price,
          currency: priceData.currency,
          price_unit: priceData.price_unit,
          effective_from: priceData.effective_from || new Date().toISOString(),
          notes: priceData.notes,
          created_by: user.id,
        });

      if (historyError) {
        console.error("Error creating price history:", historyError);
        // Not a critical error, pricing was still updated
      }
    }

    return NextResponse.json({
      message: existingPricing
        ? "Price updated successfully"
        : "Price created successfully",
      previous_price: existingPricing?.price || null,
      new_price: priceData.price,
    });
  } catch (error) {
    console.error("Price update error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
