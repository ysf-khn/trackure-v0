import React from "react";
import { redirect } from "next/navigation";
import { OrdersTable } from "@/components/orders/orders-table"; // Uncommented
import { type SupabaseClient } from "@supabase/supabase-js"; // Import SupabaseClient type
import { createClient } from "@/utils/supabase/server";

// Updated type to match query result (using payment_status)
type OrderQueryResult = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  payment_status: string | null; // Changed from status
  created_at: string;
  items: { count: number }[]; // Supabase returns count in an array for relationships
};

// Final type expected by the table component (using payment_status)
type OrderSummary = {
  id: string;
  order_number: string;
  customer_name?: string; // Keep optional for display flexibility
  payment_status: string; // Changed from status
  created_at: string;
  item_count: number;
};

// Function to fetch orders using Supabase
async function getOrdersForOrganization(
  supabase: SupabaseClient, // Accept client instance
  organizationId: string
): Promise<OrderSummary[]> {
  console.log(`Fetching orders for organization: ${organizationId}...`);

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      customer_name,
      payment_status,
      created_at,
      items ( count )
    `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    // TODO: Implement better error handling for the user
    // For now, return empty array or throw?
    return [];
  }

  // Map the data using payment_status
  const formattedOrders: OrderSummary[] = data.map(
    (order: OrderQueryResult) => ({
      id: order.id,
      order_number: order.order_number ?? "N/A", // Provide fallback
      customer_name: order.customer_name ?? undefined, // Keep undefined if null
      payment_status: order.payment_status ?? "Unknown", // Changed from status
      created_at: order.created_at,
      // Ensure items array exists and has an element before accessing count
      item_count: order.items?.[0]?.count ?? 0,
    })
  );

  return formattedOrders;
}

export default async function OrdersPage() {
  // const cookieStore = cookies(); // No longer needed here
  const supabase = await createClient(); // Await the async function

  // Use getUser() for server-side authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(
      "Error getting authenticated user or no user found:",
      userError
    );
    redirect("/login");
  }

  const userId = user.id;

  // Fetch profile to get organization_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single(); // Expect only one profile per user

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
    // Redirect or show error based on error type, e.g., profile not found
    return (
      <div className="p-4">
        Error: Could not load user profile information. Please try again or
        contact support.
      </div>
    );
  }

  if (!profile || !profile.organization_id) {
    console.error("Organization ID not found in profile for user:", userId);
    return (
      <div className="p-4">
        Error: User profile is incomplete. Organization information not found.
        Please contact support.
      </div>
    );
  }

  const organizationId = profile.organization_id;

  // Pass the supabase client to the fetching function
  const orders = await getOrdersForOrganization(supabase, organizationId);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-b from-white to-gray-800 text-transparent bg-clip-text">
        Orders
      </h1>
      {/* Render the actual table component */}
      <OrdersTable data={orders} />
    </div>
  );
}
