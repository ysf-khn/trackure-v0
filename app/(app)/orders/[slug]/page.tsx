import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { AddItemForm } from "@/components/items/add-item-form";
import OrderDetailsDisplay from "@/components/orders/order-details-display";
import PaymentStatusEditor from "@/components/orders/payment-status-editor";
import OrderItemsDisplay from "@/components/orders/order-items-display";
import { PaymentStatus } from "@/types";
import { getUserWithProfile } from "@/utils/supabase/queries";

type OrderData = {
  id: string;
  order_number: string;
  customer_name: string | null;
  payment_status: PaymentStatus | null;
  created_at: string;
  organization_id: string;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

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

  if (userRole === "Worker") {
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
    canAddItem = true;
    canEditPaymentStatus = true;
  }

  let order: OrderData | null = null;
  let orderError: string | null = null;

  if (organizationId) {
    const { data: fetchedOrder, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, payment_status, created_at, organization_id"
      )
      .eq("order_number", slug)
      .eq("organization_id", organizationId)
      .single<OrderData>();

    if (error) {
      console.error(`Order fetch error for slug ${slug}:`, error);
      orderError = "Failed to load order details.";
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

  if (orderError && !order) {
    return (
      <div className="container mx-auto p-4 text-destructive">{orderError}</div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4 text-destructive">
        An unknown error occurred loading the order.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Order: {order.order_number}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderDetailsDisplay order={order} />
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-md font-semibold mb-2">Payment Status</h3>
            {canEditPaymentStatus ? (
              <PaymentStatusEditor
                orderId={order.id}
                initialStatus={order.payment_status ?? undefined}
              />
            ) : (
              <p className="text-sm">{order.payment_status ?? "Not Set"}</p>
            )}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
