import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Vendor pricing schema
const vendorPricingSchema = z.object({
  stage_id: z.string().uuid("Invalid stage ID"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().positive("Price must be positive"),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  price_unit: z.enum(['per_piece', 'per_kg', 'per_dozen', 'per_hundred']).default('per_piece'),
  minimum_quantity: z.number().int().min(1).default(1),
  lead_time_days: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

const vendorPricingUpdateSchema = vendorPricingSchema.partial();

// GET - Get all pricing for a vendor
export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');
  const stageId = searchParams.get('stage_id');
  const includeInactive = searchParams.get('include_inactive') === 'true';

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
      .from("vendor_stage_pricing")
      .select(`
        id,
        stage_id,
        sku,
        price,
        currency,
        price_unit,
        minimum_quantity,
        lead_time_days,
        is_active,
        notes,
        created_at,
        updated_at,
        stage:workflow_stages(
          id,
          name,
          full_path,
          is_leaf_stage
        ),
        sku_details:item_master(
          name,
          description
        )
      `)
      .eq("vendor_id", vendorId)
      .order("sku")
      .order("price");

    // Apply filters
    if (sku) {
      query = query.eq("sku", sku);
    }
    if (stageId) {
      query = query.eq("stage_id", stageId);
    }
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: pricing, error } = await query;

    if (error) {
      console.error("Error fetching vendor pricing:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor pricing" },
        { status: 500 }
      );
    }

    // Group pricing by SKU for better organization
    const pricingBySku = pricing.reduce((acc, price) => {
      if (!acc[price.sku]) {
        acc[price.sku] = {
          sku: price.sku,
          sku_details: price.sku_details,
          pricing_entries: []
        };
      }
      acc[price.sku].pricing_entries.push({
        id: price.id,
        stage_id: price.stage_id,
        stage: price.stage,
        price: price.price,
        currency: price.currency,
        price_unit: price.price_unit,
        minimum_quantity: price.minimum_quantity,
        lead_time_days: price.lead_time_days,
        is_active: price.is_active,
        notes: price.notes,
        created_at: price.created_at,
        updated_at: price.updated_at,
      });
      return acc;
    }, {});

    return NextResponse.json({
      vendor_id: vendorId,
      pricing_by_sku: pricingBySku,
      total_entries: pricing.length,
      active_entries: pricing.filter(p => p.is_active).length,
      unique_skus: new Set(pricing.map(p => p.sku)).size,
      unique_stages: new Set(pricing.map(p => p.stage_id)).size,
    });

  } catch (error) {
    console.error("Vendor pricing GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Add new pricing for a vendor
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

  // Only owners can manage vendor pricing
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can manage vendor pricing" },
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

  const validationResult = vendorPricingSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const pricingData = validationResult.data;

  try {
    // Verify vendor exists and belongs to the user's organization
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", vendorId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: "Vendor not found or access denied" },
        { status: 404 }
      );
    }

    // Verify stage exists and is a leaf stage
    const { data: stage, error: stageError } = await supabase
      .from("workflow_stages")
      .select("id, is_leaf_stage, name")
      .eq("id", pricingData.stage_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (stageError || !stage) {
      return NextResponse.json(
        { error: "Stage not found or access denied" },
        { status: 404 }
      );
    }

    if (!stage.is_leaf_stage) {
      return NextResponse.json(
        { error: "Pricing can only be set for leaf stages (stages without children)" },
        { status: 400 }
      );
    }

    // Verify SKU exists
    const { data: skuExists, error: skuError } = await supabase
      .from("item_master")
      .select("sku")
      .eq("sku", pricingData.sku)
      .eq("organization_id", profile.organization_id)
      .single();

    if (skuError || !skuExists) {
      return NextResponse.json(
        { error: "SKU not found" },
        { status: 404 }
      );
    }

    // Check for existing pricing entry
    const { data: existingPricing } = await supabase
      .from("vendor_stage_pricing")
      .select("id")
      .eq("vendor_id", vendorId)
      .eq("stage_id", pricingData.stage_id)
      .eq("sku", pricingData.sku)
      .single();

    if (existingPricing) {
      return NextResponse.json(
        { error: "Pricing already exists for this vendor-stage-SKU combination" },
        { status: 409 }
      );
    }

    // Create new pricing entry
    const { data: newPricing, error: insertError } = await supabase
      .from("vendor_stage_pricing")
      .insert({
        ...pricingData,
        vendor_id: vendorId,
        organization_id: profile.organization_id,
        created_by: user.id,
      })
      .select(`
        id,
        stage_id,
        sku,
        price,
        currency,
        price_unit,
        minimum_quantity,
        lead_time_days,
        is_active,
        notes,
        created_at,
        stage:workflow_stages(name, full_path),
        sku_details:item_master(name, description)
      `)
      .single();

    if (insertError) {
      console.error("Error creating vendor pricing:", insertError);
      return NextResponse.json(
        { error: "Failed to create vendor pricing", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Vendor pricing created successfully",
      pricing: newPricing,
    }, { status: 201 });

  } catch (error) {
    console.error("Vendor pricing creation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}