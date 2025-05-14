import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Define the schema for the PATCH request body
// Allow fields to be optional for partial updates
const updateOrderSchema = z.object({
  order_number: z.string().min(1).optional(),
  customer_name: z.string().min(1).optional(),
  required_packaging_materials: z.array(z.string()).nullable().optional(), // Expecting array from frontend transformation
  packaging_reminder_trigger_stage_id: z.string().uuid().nullable().optional(),
  packaging_reminder_trigger_sub_stage_id: z
    .string()
    .uuid()
    .nullable()
    .optional(),
  // Add other editable fields as needed
});

export async function PATCH(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const cookieStore = await cookies();
  const orderId = params.orderId;

  if (!orderId) {
    return NextResponse.json(
      { error: "Order ID is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

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
