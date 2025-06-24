import React from "react";
import { redirect } from "next/navigation";
import { OrdersTable } from "@/components/orders/orders-table";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Package, Users } from "lucide-react";
import Link from "next/link";

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

// Function to calculate order statistics
function calculateOrderStats(orders: OrderSummary[]) {
  const totalOrders = orders.length;
  const totalItems = orders.reduce((sum, order) => sum + order.item_count, 0);
  const paidOrders = orders.filter(
    (order) => order.payment_status?.toLowerCase() === "paid"
  ).length;
  const uniqueCustomers = new Set(
    orders
      .filter((order) => order.customer_name)
      .map((order) => order.customer_name)
  ).size;

  return {
    totalOrders,
    totalItems,
    paidOrders,
    uniqueCustomers,
  };
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
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Could not load user profile information. Please try again or
              contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile || !profile.organization_id) {
    console.error("Organization ID not found in profile for user:", userId);
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              User profile is incomplete. Organization information not found.
              Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const organizationId = profile.organization_id;

  // Pass the supabase client to the fetching function
  const orders = await getOrdersForOrganization(supabase, organizationId);
  const stats = calculateOrderStats(orders);

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header Section */}
          <div className="px-4 lg:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ShoppingCart className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Orders
                    </h1>
                    <p className="text-muted-foreground">
                      Manage and track all your orders
                    </p>
                  </div>
                </div>
              </div>
              <Button asChild className="w-fit bg-primary text-white">
                <Link href="/orders/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="px-4 lg:px-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Orders
                  </CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    All time orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Items
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalItems}</div>
                  <p className="text-xs text-muted-foreground">
                    Items across all orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Paid Orders
                  </CardTitle>
                  <Badge
                    variant="default"
                    className="h-4 w-4 rounded-full p-0"
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.paidOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalOrders > 0
                      ? Math.round((stats.paidOrders / stats.totalOrders) * 100)
                      : 0}
                    % of total orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Buyers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.uniqueCustomers}
                  </div>
                  <p className="text-xs text-muted-foreground">Unique buyers</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Orders Table */}
          <div className="px-4 lg:px-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Orders</CardTitle>
                    <CardDescription>
                      Complete list of orders sorted by most recent
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{orders.length} orders</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <OrdersTable data={orders} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
