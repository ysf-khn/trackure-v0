import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Schema for creating vendor payment
const vendorPaymentSchema = z.object({
  vendor_order_id: z.string().uuid("Invalid order ID"),
  payment_type: z.enum(["advance", "part_payment", "force_closure", "closure"]),
  amount_paid: z.number().min(0, "Amount must be non-negative"),
  payment_date: z.string().datetime().optional(),
  remarks: z.string().optional(),
});

// GET - Get payments for a vendor
export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;
  const { searchParams } = new URL(request.url);

  const orderId = searchParams.get("order_id");
  const paymentType = searchParams.get("payment_type");
  const includeCarriedForward =
    searchParams.get("include_carried_forward") === "true";

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
      .from("vendor_payments")
      .select(
        `
        id,
        vendor_id,
        vendor_order_id,
        organization_id,
        payment_type,
        amount_paid,
        total_order_amount,
        remaining_amount,
        remarks,
        payment_date,
        is_carried_forward,
        carried_from_payment_id,
        carried_to_order_id,
        order:vendor_orders!vendor_payments_vendor_order_id_fkey(
          order_number,
          sku,
          quantity,
          status
        ),
        created_by
      `
      )
      .eq("vendor_id", vendorId)
      .order("payment_date", { ascending: false });

    // Apply filters
    if (orderId) {
      query = query.eq("vendor_order_id", orderId);
    }

    if (paymentType) {
      query = query.eq("payment_type", paymentType);
    }

    if (!includeCarriedForward) {
      query = query.eq("is_carried_forward", false);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error("Error fetching vendor payments:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor payments" },
        { status: 500 }
      );
    }

    // Get outstanding payments summary
    const { data: outstandingData } = await supabase.rpc(
      "get_vendor_outstanding_payments",
      {
        p_vendor_id: vendorId,
        p_organization_id: payments[0]?.organization_id,
      }
    );

    // Calculate payment statistics
    const stats = {
      total_payments: payments.length,
      total_amount_paid: payments.reduce(
        (sum, p) => sum + Number(p.amount_paid),
        0
      ),
      payment_types: {
        advance: payments.filter((p) => p.payment_type === "advance").length,
        part_payment: payments.filter((p) => p.payment_type === "part_payment")
          .length,
        force_closure: payments.filter(
          (p) => p.payment_type === "force_closure"
        ).length,
        closure: payments.filter((p) => p.payment_type === "closure").length,
      },
      carried_forward_count: payments.filter((p) => p.is_carried_forward)
        .length,
      outstanding_summary: outstandingData?.[0] || {
        total_outstanding: 0,
        outstanding_orders: [],
      },
    };

    return NextResponse.json({
      payments,
      statistics: stats,
    });
  } catch (error) {
    console.error("Vendor payments GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Create a new payment for a vendor order
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
    const { data: hasPermission } = await supabase.rpc(
      "worker_has_permission",
      { permission_key: "vendors.manage_payments" }
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Insufficient permissions to manage vendor payments",
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

  const validationResult = vendorPaymentSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const paymentData = validationResult.data;

  try {
    // Verify the order exists and belongs to the vendor
    const { data: order, error: orderError } = await supabase
      .from("vendor_orders")
      .select("id, vendor_id, total_amount, organization_id, order_number, sku")
      .eq("id", paymentData.vendor_order_id)
      .single();

    if (orderError || order.vendor_id !== vendorId) {
      return NextResponse.json(
        { error: "Order not found or does not belong to this vendor" },
        { status: 404 }
      );
    }

    if (order.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get existing payments for this order
    const { data: existingPayments, error: paymentsError } = await supabase
      .from("vendor_payments")
      .select("amount_paid, payment_type, payment_date, remarks")
      .eq("vendor_order_id", paymentData.vendor_order_id);

    if (paymentsError) {
      console.error("Error fetching existing payments:", paymentsError);
      return NextResponse.json(
        { error: "Failed to check existing payments" },
        { status: 500 }
      );
    }

    // Check if payment already exists for this order (temporary restriction)
    if (existingPayments && existingPayments.length > 0) {
      return NextResponse.json(
        {
          error: "Payment already exists for this order",
          details:
            "Currently, only one payment per order is allowed. This order already has a payment recorded.",
          existing_payment: {
            payment_type: existingPayments[0].payment_type,
            amount_paid: existingPayments[0].amount_paid,
            payment_date: existingPayments[0].payment_date,
            remarks: existingPayments[0].remarks,
          },
        },
        { status: 400 }
      );
    }

    // Since we're blocking multiple payments for now, total paid is 0
    const totalPaid = 0;
    const remainingAmount = Number(order.total_amount);

    // Validate payment amount
    if (
      paymentData.payment_type === "closure" &&
      paymentData.amount_paid !== remainingAmount
    ) {
      return NextResponse.json(
        {
          error: "Invalid payment amount",
          details: `Closure payment must be exactly ${remainingAmount} to settle the order`,
        },
        { status: 400 }
      );
    }

    if (
      paymentData.amount_paid > remainingAmount &&
      paymentData.payment_type !== "advance"
    ) {
      return NextResponse.json(
        {
          error: "Payment amount exceeds remaining balance",
          details: `Remaining amount is ${remainingAmount}`,
        },
        { status: 400 }
      );
    }

    // Create the payment
    // If payment_date is provided, use that date but with current time for proper ordering
    let paymentDate = new Date().toISOString();
    if (paymentData.payment_date) {
      const providedDate = new Date(paymentData.payment_date);
      const currentTime = new Date();
      providedDate.setHours(currentTime.getHours());
      providedDate.setMinutes(currentTime.getMinutes());
      providedDate.setSeconds(currentTime.getSeconds());
      providedDate.setMilliseconds(currentTime.getMilliseconds());
      paymentDate = providedDate.toISOString();
    }

    const { data: newPayment, error: insertError } = await supabase
      .from("vendor_payments")
      .insert({
        vendor_id: vendorId,
        organization_id: profile.organization_id,
        vendor_order_id: paymentData.vendor_order_id,
        payment_type: paymentData.payment_type,
        amount_paid: paymentData.amount_paid,
        total_order_amount: order.total_amount,
        remarks: paymentData.remarks,
        payment_date: paymentDate,
        created_by: user.id,
        is_carried_forward: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating payment:", insertError);
      return NextResponse.json(
        { error: "Failed to create payment", details: insertError.message },
        { status: 500 }
      );
    }

    // If this is a closure or force_closure, update the order status
    if (
      paymentData.payment_type === "closure" ||
      paymentData.payment_type === "force_closure"
    ) {
      await supabase
        .from("vendor_orders")
        .update({
          status: "completed",
          actual_completion: new Date().toISOString(),
        })
        .eq("id", paymentData.vendor_order_id);
    }

    return NextResponse.json(
      {
        message: "Payment recorded successfully",
        payment: newPayment,
        order_summary: {
          order_number: order.order_number,
          total_amount: order.total_amount,
          total_paid: totalPaid + paymentData.amount_paid,
          remaining: Math.max(
            0,
            Number(order.total_amount) - (totalPaid + paymentData.amount_paid)
          ),
          payment_complete:
            totalPaid + paymentData.amount_paid >= Number(order.total_amount),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Vendor payment creation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
