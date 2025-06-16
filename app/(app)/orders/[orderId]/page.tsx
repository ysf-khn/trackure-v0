import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added Card imports
import { createClient } from "@/utils/supabase/server";
import { AddItemForm } from "@/components/items/add-item-form";
import OrderDetailsDisplay from "@/components/orders/order-details-display";
import PaymentStatusEditor from "@/components/orders/payment-status-editor";
import OrderItemsDisplay from "@/components/orders/order-items-display";
import { PaymentStatus } from "@/types";
import { getUserWithProfile } from "@/utils/supabase/queries";
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
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  // Fetch user session and profile server-side
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  let userRole: string | null = null;
  let organizationId: string | null = null;
  let canAddItem = false;
  let canEditPaymentStatus = false;
  let isOwner = false;

  if (
    userProfileError ||
    !user ||
    !profile?.organization_id ||
    !profile?.role
  ) {
    return (
      <div className="container mx-auto p-4 text-destructive">
        {userProfileError?.message ||
          "Authentication failed or profile incomplete"}
      </div>
    );
  }

  userRole = profile.role;
  organizationId = profile.organization_id;
  isOwner = userRole === "Owner";

  // Check permissions using the database function
  if (userRole === "Worker") {
    // For workers, we need to check their specific permissions
    // We'll fetch these permissions and check them
    const { data: itemAddPermission } = await supabase.rpc(
      "worker_has_permission",
      {
        permission_key: "items.add",
      }
    );
    const { data: paymentStatusPermission } = await supabase.rpc(
      "worker_has_permission",
      {
        permission_key: "orders.payment_status",
      }
    );

    canAddItem = itemAddPermission || false;
    canEditPaymentStatus = paymentStatusPermission || false;
  } else if (userRole === "Owner") {
    // Owners have all permissions
    canAddItem = true;
    canEditPaymentStatus = true;
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
  } else {
    orderError =
      "User profile is incomplete (missing organization). Access denied.";
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
            {canEditPaymentStatus ? (
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

      {/* Section to Add New Items - Conditionally render based on permissions */}
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

      {/* Order Items Section */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderItemsDisplay
            orderId={order.id}
            organizationId={organizationId}
            userRole={userRole}
          />
        </CardContent>
      </Card>

      {/* --- PDF Download Section --- */}
      {/* {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
          </CardHeader>
          <CardContent>
           
            <p className="text-sm text-muted-foreground">
              (Download Invoice Button Placeholder)
            </p>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
}
