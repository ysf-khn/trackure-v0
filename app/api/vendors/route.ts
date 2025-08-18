import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Vendor creation/update schema
const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  firm_name: z.string().optional(),
  gst: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  remarks: z.string().optional(),
  is_active: z.boolean().default(true),
});

// GET - List all vendors for the organization
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
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
      .from("vendors")
      .select(`
        id,
        name,
        firm_name,
        gst,
        address,
        phone,
        email,
        remarks,
        is_active,
        created_at,
        updated_at,
        pricing:vendor_stage_pricing(
          id,
          stage_id,
          sku,
          price,
          currency,
          price_unit,
          minimum_quantity,
          lead_time_days,
          is_active,
          stage:workflow_stages(name, full_path)
        )
      `)
      .order("name");

    // Filter by active status if not including inactive
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: vendors, error } = await query;

    if (error) {
      console.error("Error fetching vendors:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      );
    }

    // Get outstanding amounts for all vendors
    const { data: outstandingPayments } = await supabase
      .from("vendor_payments")
      .select("vendor_id, remaining_amount, vendor_order_id, payment_date")
      .order("payment_date", { ascending: false });

    // Calculate outstanding amounts per vendor
    const vendorOutstandingMap = new Map();
    const processedOrders = new Set();

    outstandingPayments?.forEach(payment => {
      // Only process each order once (get the latest payment)
      if (!processedOrders.has(payment.vendor_order_id)) {
        processedOrders.add(payment.vendor_order_id);
        const remainingAmount = Number(payment.remaining_amount) || 0;
        
        if (remainingAmount > 0) {
          const currentOutstanding = vendorOutstandingMap.get(payment.vendor_id) || 0;
          vendorOutstandingMap.set(payment.vendor_id, currentOutstanding + remainingAmount);
        }
      }
    });

    // Calculate vendor statistics
    const vendorsWithStats = vendors.map(vendor => {
      const activePricing = vendor.pricing.filter(p => p.is_active);
      const uniqueSkus = new Set(activePricing.map(p => p.sku));
      const uniqueStages = new Set(activePricing.map(p => p.stage_id));
      
      return {
        ...vendor,
        stats: {
          active_pricing_count: activePricing.length,
          supported_skus: uniqueSkus.size,
          supported_stages: uniqueStages.size,
          avg_price: activePricing.length > 0 
            ? activePricing.reduce((sum, p) => sum + Number(p.price), 0) / activePricing.length
            : 0,
          avg_lead_time: activePricing.length > 0
            ? activePricing.reduce((sum, p) => sum + p.lead_time_days, 0) / activePricing.length
            : 0,
          outstanding_amount: vendorOutstandingMap.get(vendor.id) || 0,
        }
      };
    });

    return NextResponse.json({
      vendors: vendorsWithStats,
      meta: {
        total_count: vendors.length,
        active_count: vendors.filter(v => v.is_active).length,
        inactive_count: vendors.filter(v => !v.is_active).length,
      }
    });

  } catch (error) {
    console.error("Vendors GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Create a new vendor
export async function POST(request: Request) {
  const supabase = await createClient();

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

  // Only owners can create vendors
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only owners can create vendors" },
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

  const validationResult = vendorSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const vendorData = validationResult.data;

  try {
    const { data: newVendor, error: insertError } = await supabase
      .from("vendors")
      .insert({
        ...vendorData,
        organization_id: profile.organization_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating vendor:", insertError);
      return NextResponse.json(
        { error: "Failed to create vendor", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Vendor created successfully",
      vendor: newVendor,
    }, { status: 201 });

  } catch (error) {
    console.error("Vendor creation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PUT - Update a vendor (handled by dynamic route)
// DELETE - Delete a vendor (handled by dynamic route)