import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";

// GET - Get payment summary for all vendors
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Get date range parameters
  const period = searchParams.get("period") || "last_30_days";
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 }
    );
  }

  try {
    // Calculate date range based on period
    let startDate: Date;
    let endDate: Date = endOfDay(new Date());

    if (period === "custom" && fromDate && toDate) {
      startDate = startOfDay(new Date(fromDate));
      endDate = endOfDay(new Date(toDate));
    } else {
      switch (period) {
        case "last_7_days":
          startDate = startOfDay(subDays(new Date(), 7));
          break;
        case "last_90_days":
          startDate = startOfDay(subDays(new Date(), 90));
          break;
        case "this_month":
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
        case "last_month":
          const lastMonth = subDays(startOfMonth(new Date()), 1);
          startDate = startOfMonth(lastMonth);
          endDate = endOfMonth(lastMonth);
          break;
        case "last_30_days":
        default:
          startDate = startOfDay(subDays(new Date(), 30));
          break;
      }
    }

    // Get vendor counts
    const { data: vendorCounts, error: vendorError } = await supabase
      .from("vendors")
      .select("id, is_active")
      .eq("organization_id", profile.organization_id);

    if (vendorError) {
      throw vendorError;
    }

    const totalVendors = vendorCounts?.length || 0;
    const activeVendors = vendorCounts?.filter(v => v.is_active).length || 0;

    // Get vendors with payments in the date range
    const { data: vendorsWithPayments, error: activeVendorError } = await supabase
      .from("vendor_payments")
      .select("vendor_id")
      .eq("organization_id", profile.organization_id)
      .gte("payment_date", startDate.toISOString())
      .lte("payment_date", endDate.toISOString());

    if (activeVendorError) {
      throw activeVendorError;
    }

    const uniqueVendorsWithPayments = new Set(vendorsWithPayments?.map(p => p.vendor_id) || []);
    const vendorsWithActivity = uniqueVendorsWithPayments.size;

    // Get payment totals within date range
    const { data: paymentData, error: paymentError } = await supabase
      .from("vendor_payments")
      .select("amount_paid, payment_type")
      .eq("organization_id", profile.organization_id)
      .gte("payment_date", startDate.toISOString())
      .lte("payment_date", endDate.toISOString())
      .eq("is_carried_forward", false); // Exclude carried forward payments

    if (paymentError) {
      throw paymentError;
    }

    const totalPayments = paymentData?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
    
    // Get payment breakdown by type
    const paymentBreakdown = {
      advance: 0,
      part_payment: 0,
      force_closure: 0,
      closure: 0,
    };

    paymentData?.forEach(p => {
      if (p.payment_type in paymentBreakdown) {
        paymentBreakdown[p.payment_type as keyof typeof paymentBreakdown] += Number(p.amount_paid);
      }
    });

    // Get current outstanding amounts by getting the latest payment record for each order
    const { data: latestPayments, error: outstandingError } = await supabase
      .from("vendor_payments")
      .select("remaining_amount, vendor_order_id, payment_date")
      .eq("organization_id", profile.organization_id)
      .order("payment_date", { ascending: false });

    if (outstandingError) {
      throw outstandingError;
    }

    // Get the most recent payment for each order to get current remaining amount
    const orderRemainingAmounts = new Map();
    latestPayments?.forEach(payment => {
      if (!orderRemainingAmounts.has(payment.vendor_order_id)) {
        const remainingAmount = Number(payment.remaining_amount) || 0;
        if (remainingAmount > 0) {
          orderRemainingAmounts.set(payment.vendor_order_id, remainingAmount);
        }
      }
    });

    const totalOutstanding = Array.from(orderRemainingAmounts.values()).reduce((sum, amount) => sum + amount, 0);
    const outstandingOrders = orderRemainingAmounts.size;

    return NextResponse.json({
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        period,
      },
      vendors: {
        total: totalVendors,
        active: activeVendors,
        withActivityInPeriod: vendorsWithActivity,
      },
      payments: {
        total: totalPayments,
        count: paymentData?.length || 0,
        breakdown: paymentBreakdown,
      },
      outstanding: {
        total: totalOutstanding,
        orderCount: outstandingOrders,
      },
    });

  } catch (error) {
    console.error("Vendor payment summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment summary" },
      { status: 500 }
    );
  }
}