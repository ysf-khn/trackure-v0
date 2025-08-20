import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Schema for creating vendor order
const vendorOrderSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  stage_id: z.string().uuid("Invalid stage ID"),
  item_id: z.string().uuid("Invalid item ID").optional(),
  allocation_id: z.string().uuid("Invalid allocation ID").optional(),
  expected_completion: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// GET - Get orders for a vendor
export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const sku = searchParams.get("sku");
  const includePayments = searchParams.get("include_payments") === "true";

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseSelect = `
        id,
        vendor_id,
        organization_id,
        order_number,
        sku,
        quantity,
        unit_price,
        total_amount,
        currency,
        stage_id,
        item_id,
        allocation_id,
        status,
        expected_completion,
        actual_completion,
        created_at,
        stage:workflow_stages(name, full_path),
        sku_details:item_master(master_details),
        item:items(
          order_id, 
          remaining_quantity,
          order:orders(
            id,
            order_number,
            customer_name
          )
        )`;
    
    const paymentsSelect = includePayments
      ? `,payments:vendor_payments!vendor_payments_vendor_order_id_fkey(
          id,
          payment_type,
          amount_paid,
          payment_date,
          remarks,
          is_carried_forward
        )`
      : "";

    let query = supabase
      .from("vendor_orders")
      .select(baseSelect + paymentsSelect)
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    if (sku) {
      query = query.eq("sku", sku);
    }

    // Type definition for vendor order from query
    type VendorOrder = {
      id: string;
      vendor_id: string;
      organization_id: string;
      order_number: string;
      sku: string;
      quantity: number;
      unit_price: number;
      total_amount: number;
      currency: string;
      stage_id: string;
      item_id: string | null;
      allocation_id: string | null;
      status: string;
      expected_completion: string | null;
      actual_completion: string | null;
      created_at: string;
      stage: { name: string; full_path: string } | null;
      sku_details: { master_details: any } | null;
      item: {
        order_id: string;
        remaining_quantity: number;
        order: {
          id: string;
          order_number: string;
          customer_name: string;
        } | null;
      } | null;
      payments?: Array<{
        id: string;
        payment_type: string;
        amount_paid: number;
        payment_date: string;
        remarks: string | null;
        is_carried_forward: boolean;
      }>;
    };

    const { data: orders, error } = await query as { data: VendorOrder[] | null; error: any };

    if (error || !orders) {
      console.error("Error fetching vendor orders:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor orders" },
        { status: 500 }
      );
    }

    // Calculate payment summary for each order and add customer order details
    const ordersWithPaymentSummary = orders.map((order) => {
      const payments = includePayments && 'payments' in order ? order.payments || [] : [];
      const totalPaid = payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount_paid),
        0
      );
      const remainingAmount = Number(order.total_amount) - totalPaid;
      
      // Get the most recent payment details for display
      const lastPayment = payments.length > 0 
        ? payments[payments.length - 1]
        : null;

      return {
        ...order,
        // Add actual customer order details
        customer_order_number: order.item?.order?.order_number || "-",
        customer_name: order.item?.order?.customer_name || "-",
        payment_summary: {
          total_paid: totalPaid,
          remaining_amount: remainingAmount,
          payment_status:
            remainingAmount === 0
              ? "paid"
              : totalPaid > 0
                ? "partial"
                : "unpaid",
          payment_count: payments.length,
          has_carryforward: payments.some((p: any) => p.is_carried_forward),
          last_payment_type: lastPayment?.payment_type || null,
          last_payment_remarks: lastPayment?.remarks || null,
        },
      };
    });

    // Get vendor's outstanding payments summary
    const { data: outstandingData } = await supabase.rpc(
      "get_vendor_outstanding_payments",
      {
        p_vendor_id: vendorId,
        p_organization_id: orders[0]?.organization_id,
      }
    );

    return NextResponse.json({
      orders: ordersWithPaymentSummary,
      summary: {
        total_orders: orders.length,
        pending_orders: orders.filter((o) => o.status === "pending").length,
        in_progress_orders: orders.filter((o) => o.status === "in_progress")
          .length,
        completed_orders: orders.filter((o) => o.status === "completed").length,
        total_value: orders.reduce((sum, o) => sum + Number(o.total_amount), 0),
        outstanding_payment: outstandingData?.[0]?.total_outstanding || 0,
      },
    });
  } catch (error) {
    console.error("Vendor orders GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Create a new vendor order
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

  // Check permissions
  if (profile.role !== "Owner") {
    // Check worker permissions
    const { data: hasPermission } = await supabase.rpc(
      "worker_has_permission",
      { permission_key: "vendors.manage_orders" }
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: "Forbidden: Insufficient permissions to create vendor orders",
        },
        { status: 403 }
      );
    }
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

  const validationResult = vendorOrderSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const orderData = validationResult.data;

  try {
    // Verify vendor belongs to organization
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("organization_id, name")
      .eq("id", vendorId)
      .single();

    if (vendorError || vendor.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "Vendor not found or access denied" },
        { status: 404 }
      );
    }

    // Generate order number
    const timestamp = Date.now();
    const orderNumber = `VO-${vendorId.slice(0, 8).toUpperCase()}-${timestamp}`;

    // Calculate total amount
    const totalAmount = orderData.quantity * orderData.unit_price;

    // Create the order
    const { data: newOrder, error: insertError } = await supabase
      .from("vendor_orders")
      .insert({
        vendor_id: vendorId,
        organization_id: profile.organization_id,
        order_number: orderNumber,
        sku: orderData.sku,
        quantity: orderData.quantity,
        unit_price: orderData.unit_price,
        total_amount: totalAmount,
        currency: orderData.currency,
        stage_id: orderData.stage_id,
        item_id: orderData.item_id,
        allocation_id: orderData.allocation_id,
        status: "pending",
        expected_completion: orderData.expected_completion,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating vendor order:", insertError);
      return NextResponse.json(
        {
          error: "Failed to create vendor order",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    // Process any carryforward payments
    await supabase.rpc("process_vendor_payment_carryforward", {
      p_vendor_id: vendorId,
      p_new_order_id: newOrder.id,
    });

    // Update item_vendor_assignments if allocation_id is provided
    if (orderData.allocation_id) {
      await supabase.from("item_vendor_assignments").insert({
        item_id: orderData.item_id!,
        allocation_id: orderData.allocation_id,
        vendor_id: vendorId,
        quantity: orderData.quantity,
        price_per_unit: orderData.unit_price,
        total_price: totalAmount,
        currency: orderData.currency,
        expected_completion: orderData.expected_completion,
        assigned_by: user.id,
        organization_id: profile.organization_id,
      });
    }

    // Create or update vendor_stage_pricing to ensure vendor appears in workflow
    // This maintains the pricing configuration for this vendor-stage-SKU combination
    const { error: pricingError } = await supabase
      .from("vendor_stage_pricing")
      .upsert({
        vendor_id: vendorId,
        stage_id: orderData.stage_id,
        sku: orderData.sku,
        organization_id: profile.organization_id,
        price: orderData.unit_price,
        currency: orderData.currency,
        price_unit: "per_piece",
        is_active: true,
        notes: orderData.notes || `Created from order ${orderNumber}`,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "vendor_id,stage_id,sku",
        ignoreDuplicates: false,
      });

    if (pricingError) {
      console.warn("Failed to update vendor_stage_pricing:", pricingError);
      // Don't fail the entire request, just log the warning
      // The vendor order is already created successfully
    }

    return NextResponse.json(
      {
        message: "Vendor order created successfully",
        order: newOrder,
        order_number: orderNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Vendor order creation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PATCH - Update vendor order status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params;
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json(
      { error: "order_id query parameter is required" },
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

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { status, actual_completion } = body;

  if (
    !status ||
    !["pending", "in_progress", "completed", "cancelled"].includes(status)
  ) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 }
    );
  }

  try {
    const updateData: any = { status };

    if (status === "completed" && actual_completion) {
      updateData.actual_completion = actual_completion;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("vendor_orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating vendor order:", updateError);
      return NextResponse.json(
        { error: "Failed to update vendor order" },
        { status: 500 }
      );
    }

    // If completed, update the item_vendor_assignments
    if (status === "completed" && updatedOrder.allocation_id) {
      await supabase
        .from("item_vendor_assignments")
        .update({ completed_at: actual_completion || new Date().toISOString() })
        .eq("allocation_id", updatedOrder.allocation_id)
        .eq("vendor_id", updatedOrder.vendor_id);
    }

    return NextResponse.json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Order status update error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
