"use server";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type PaymentStatus } from "@/types";
import { createClient } from "@/utils/supabase/server";

const patchSchema = z.object({
  payment_status: z.enum(["Lent", "Credit", "Paid"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = await createClient();
  const { orderId } = await params;

  // 1. Check user authentication and fetch profile
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, organization_id") // Select role and org_id
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error(`Profile error for user ${user.id}:`, profileError);
    return NextResponse.json(
      { error: profileError?.message || "User profile not found" },
      { status: 404 }
    );
  }

  // Role Check
  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Only Owners can update payment status." },
      { status: 403 }
    );
  }

  // Ensure organization_id exists (consistent with other routes)
  if (!profile.organization_id) {
    console.error("User does not belong to an organization:", user.id);
    return NextResponse.json(
      { error: "User not associated with an organization" },
      { status: 400 } // Or 403/401 depending on policy
    );
  }

  // 2. Validate request body
  let validatedData: { payment_status: PaymentStatus };
  try {
    validatedData = await patchSchema.parseAsync(await req.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: error instanceof z.ZodError ? error.errors : "Unknown error",
      },
      { status: 400 }
    );
  }

  const payment_status: PaymentStatus = validatedData.payment_status;

  // 3. Fetch the order to ensure it belongs to the user's organization (implicit RLS check)
  //    We still do this check, even though RLS *should* handle it, as an extra verification
  //    that the order exists and belongs to the *correct* organization from the profile.
  const { data: orderOrg, error: orderFetchError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("organization_id", profile.organization_id) // Explicit org check
    .maybeSingle();

  if (orderFetchError) {
    console.error("Database error fetching order:", orderFetchError);
    return NextResponse.json(
      { error: "Database error checking order." },
      { status: 500 }
    );
  }

  if (!orderOrg) {
    console.warn(
      `Order not found or access denied for orderId: ${orderId}, orgId: ${profile.organization_id}`
    );
    return NextResponse.json(
      { error: "Order not found or access denied." },
      { status: 404 }
    );
  }

  // 4. Update the order status
  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: payment_status })
    .eq("id", orderId)
    .eq("organization_id", profile.organization_id); // Ensure update is also scoped to org

  if (updateError) {
    console.error("Error updating payment status:", updateError);
    return NextResponse.json(
      { error: "Failed to update payment status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
