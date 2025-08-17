import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { AddItemSheet } from "@/components/orders/add-item-sheet";
import OrderItemsDisplay from "@/components/orders/order-items-display";
import { OrderHeader } from "@/components/orders/order-header";
import { OrderStatsContainer } from "@/components/orders/order-stats-container";
import { OrderTimeline } from "@/components/orders/order-timeline";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header Section */}
        <OrderHeader 
          order={order} 
          canExport={isOwner || userRole === "Owner"}
          canEditPaymentStatus={canEditPaymentStatus}
        />

        {/* Stats Overview */}
        <OrderStatsContainer 
          orderId={order.id} 
          organizationId={organizationId}
        />

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-lg border border-primary/10">
          <div>
            <h2 className="font-semibold text-foreground">Order Management</h2>
            <p className="text-sm text-muted-foreground">
              Add items, track progress, and manage this order
            </p>
          </div>
          <AddItemSheet orderId={order.id} canAddItem={canAddItem} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="xl:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  Items
                </CardTitle>
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

          {/* Sidebar Column - Activity Timeline Only */}
          <div className="space-y-6">
            <OrderTimeline orderId={order.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
