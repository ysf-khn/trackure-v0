import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added Card imports
import { createClient } from "@/utils/supabase/server";
import { AddItemForm } from "@/components/items/add-item-form";
import OrderDetailsDisplay from "@/components/orders/order-details-display";
import PaymentStatusEditor from "@/components/orders/payment-status-editor";
import { PaymentStatus } from "@/types";
// import { headers } from 'next/headers'; // Needed for createClient - REMOVED
// import { OrderDetails } from '@/components/orders/order-details'; // Hypothetical component
// import { ItemListTable } from '@/components/items/item-list-table'; // For displaying items later

// type OrderDetailPageProps = {
//   params: {
//     orderId: string;
//   };
//   searchParams?: { [key: string]: string | string[] | undefined };
// };

// Define a type for the fetched order data
type OrderData = {
  id: string;
  order_number: string;
  customer_name: string | null;
  payment_status: PaymentStatus | null;
  created_at: string;
  organization_id: string; // Needed for potential queries within components
  // Add other fields as needed
};

export default async function OrderDetailPage({
  params,
}: {
  params: { orderId: string };
}) {
  const { orderId } = params; // Removed await here
  const supabase = await createClient();

  // Fetch user session and profile server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: string | null = null;
  let organizationId: string | null = null;
  let canAddItem = false;
  let isOwner = false; // Initialize isOwner

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id") // Fetch org_id too
      .eq("id", user.id)
      .single();

    userRole = profile?.role ?? null;
    organizationId = profile?.organization_id ?? null;
    isOwner = userRole === "Owner";
    canAddItem = userRole === "Owner" || userRole === "Worker";
  }

  // Fetch order details - MUST check organizationId for security
  let order: OrderData | null = null;
  let orderError: string | null = null;

  if (organizationId) {
    const { data: fetchedOrder, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, payment_status, created_at, organization_id"
      )
      .eq("id", orderId)
      .eq("organization_id", organizationId) // <<< Security check
      .single<OrderData>();

    if (error) {
      console.error(`Order fetch error for ${orderId}:`, error);
      orderError = "Failed to load order details.";
      // Handle specific errors like Pgrst116 (Not Found) differently if needed
      if (error.code === "PGRST116") {
        orderError = "Order not found or access denied.";
      }
    } else {
      order = fetchedOrder;
    }
  } else if (user) {
    // User is logged in but has no organization_id in profile
    orderError =
      "User profile is incomplete (missing organization). Access denied.";
  } else {
    // User is not logged in
    // This case should ideally be handled by middleware, but double-check
    orderError = "Unauthorized. Please log in.";
    // Consider redirecting here if middleware isn't catching this
    // redirect("/login");
  }

  // Handle error display or redirection
  if (orderError && !order) {
    // Use a dedicated error display component or simple div
    return (
      <div className="container mx-auto p-4 text-destructive">{orderError}</div>
    );
  }

  if (!order) {
    // Should not happen if error handling above is correct, but as a fallback
    return (
      <div className="container mx-auto p-4 text-destructive">
        An unknown error occurred loading the order.
      </div>
    );
  }

  // --- Render Page Content ---
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Order: {order.order_number}</h1>

      {/* Order Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderDetailsDisplay order={order} />
          {/* Payment Status Display/Edit */}
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-md font-semibold mb-2">Payment Status</h3>
            {isOwner ? (
              <PaymentStatusEditor
                orderId={order.id}
                initialStatus={order.payment_status ?? undefined} // Pass undefined if null
              />
            ) : (
              <p className="text-sm">{order.payment_status ?? "Not Set"}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section to Add New Items - Conditionally render based on role */}
      {canAddItem && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Item</CardTitle>
          </CardHeader>
          <CardContent>
            <AddItemForm orderId={order.id} />
          </CardContent>
        </Card>
      )}

      {/* --- PDF Download Section --- */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Download Invoice Button Placeholder */}
            <p className="text-sm text-muted-foreground">
              (Download Invoice Button Placeholder)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Placeholder for Item List */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            (Placeholder for Item List with Download Voucher Action)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
