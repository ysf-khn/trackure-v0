import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Define the schema for the PATCH request body
// Allow fields to be optional for partial updates
// Packaging reminder fields removed - coming soon
const updateOrderSchema = z.object({
  order_number: z.string().min(1).optional(),
  customer_name: z.string().min(1).optional(),
  // Add other editable fields as needed
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!orderId) {
    return NextResponse.json(
      { error: "Order ID is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    // 1. Verify user authentication and authorization
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch profile to get organization_id and role for RBAC
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(`Profile error for user ${user.id}:`, profileError);
      return NextResponse.json(
        { error: profileError?.message || "User profile not found" },
        { status: 404 }
      );
    }

    const organization_id = profile.organization_id;
    const user_role = profile.role;

    // RBAC Check: Define who can update orders (e.g., Owner or Worker)
    // For now, let's assume both can, adjust as needed.
    if (user_role !== "Owner" && user_role !== "Worker") {
      console.warn(`User role '${user_role}' not permitted to update orders.`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Parse and validate request body
    const json = await request.json();
    const validatedData = updateOrderSchema.safeParse(json);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.flatten() },
        { status: 400 }
      );
    }

    const updatePayload = validatedData.data;

    // 3. Update the order in Supabase
    const { data: updatedOrder, error: dbError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .eq("organization_id", organization_id) // IMPORTANT: Ensure user can only update orders in their org
      .select()
      .single();

    if (dbError) {
      console.error(`Error updating order ${orderId}:`, dbError);
      // Handle specific errors like P2025 (Record not found) if needed
      if (dbError.code === "PGRST116") {
        // PGRST116 often indicates 0 rows updated/returned
        return NextResponse.json(
          { error: `Order not found or user does not have permission.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: dbError.message || "Failed to update order" },
        { status: 500 }
      );
    }

    if (!updatedOrder) {
      // This case might be covered by the dbError check above, but good as a fallback
      console.error(`Order ${orderId} not found or update failed silently.`);
      return NextResponse.json(
        { error: `Order not found or update failed.` },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedOrder, { status: 200 }); // Return updated order data
  } catch (error) {
    console.error(`Error in PATCH /api/orders/${orderId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
