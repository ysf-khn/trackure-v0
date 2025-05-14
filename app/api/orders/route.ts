import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Define the schema for the request body (mirroring the frontend form)
const createOrderSchema = z.object({
  order_number: z.string().min(1),
  customer_name: z.string().min(1),
  total_quantity: z.number().int().positive(),
  // Add other fields matching the form schema if needed
});

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
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

    // Fetch profile details from the 'profiles' table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role") // Fetch organization_id and role
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(`Profile error for user ${user.id}:`, profileError);
      return NextResponse.json(
        { error: profileError?.message || "User profile not found" },
        { status: 404 } // Use 404 if profile not found
      );
    }

    const organization_id = profile.organization_id;
    const user_role = profile.role; // Get role from profile table

    if (!organization_id) {
      console.error("User does not belong to an organization:", user.id);
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // 2. RBAC Check (Task 1.3 & 7.1)
    // Assuming Worker can create orders based on original comment
    if (user_role !== "Owner" && user_role !== "Worker") {
      console.warn(`User role '${user_role}' not permitted to create orders.`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json();
    const validatedData = createOrderSchema.safeParse(json);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.flatten() }, // Use flatten for better error messages
        { status: 400 }
      );
    }

    const { order_number, customer_name, total_quantity } = validatedData.data;

    // 3. Use Supabase server client to INSERT into orders table (Task 1.3)
    const { data: newOrder, error: dbError } = await supabase
      .from("orders")
      .insert([
        {
          organization_id,
          order_number,
          customer_name,
          total_quantity,
          // Add other fields from validatedData if they exist in the schema...
        },
      ])
      .select() // Select the newly created order
      .single(); // Expect only one row back

    if (dbError) {
      console.error("Error creating order:", dbError);
      // Add more specific error handling if needed (e.g., unique constraint violation)
      return NextResponse.json(
        { error: dbError.message || "Failed to create order" },
        { status: 500 }
      );
    }

    if (!newOrder) {
      console.error(
        "Order creation returned no data, though no error reported."
      );
      return NextResponse.json(
        { error: "Failed to create order - no data returned" },
        { status: 500 }
      );
    }

    return NextResponse.json(newOrder, { status: 201 }); // Return the created order data
  } catch (error) {
    console.error("Error in POST /api/orders:", error);
    // Handle potential JSON parsing errors or other unexpected errors
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
