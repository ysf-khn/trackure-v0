"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, Package2Icon, ExternalLinkIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface CompletedItem {
  id: string;
  sku: string;
  buyer_id: string | null;
  total_quantity: number;
  remaining_quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
  order: {
    id: string;
    order_number: string;
    customer_name: string | null;
    status: string;
  };
}

const fetchCompletedItems = async (): Promise<CompletedItem[]> => {
  const supabase = createClient();

  // Get the current user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw new Error("User organization not found");
  }

  // Fetch completed items with order information
  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      sku,
      buyer_id,
      total_quantity,
      remaining_quantity,
      status,
      created_at,
      updated_at,
      orders (
        id,
        order_number,
        customer_name,
        status
      )
    `
    )
    .eq("organization_id", profile.organization_id)
    .eq("status", "Completed")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch completed items: ${error.message}`);
  }

  // Transform the data to match our interface
  const transformedData = (data || [])
    .map((item) => ({
      ...item,
      order: Array.isArray(item.orders) ? item.orders[0] : item.orders,
    }))
    .filter((item) => item.order); // Filter out items without order data

  return transformedData as CompletedItem[];
};

export default function CompletedItemsPage() {
  const {
    data: completedItems,
    isLoading,
    isError,
    error,
  } = useQuery<CompletedItem[], Error>({
    queryKey: ["completedItems"],
    queryFn: fetchCompletedItems,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Error loading completed items: {error?.message || "Unknown error"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2Icon className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Completed Items</h1>
        </div>
        <p className="text-muted-foreground">
          View all items that have completed the entire workflow lifecycle.
        </p>
      </div>

      {completedItems && completedItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package2Icon className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Completed Items</h3>
            <p className="text-muted-foreground text-center mb-4">
              Items will appear here once they complete the entire workflow.
            </p>
            <Link href="/new-orders" passHref>
              <Button>
                <Package2Icon className="mr-2 h-4 w-4" />
                View New Orders
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {completedItems?.length || 0} completed item
              {completedItems?.length !== 1 ? "s" : ""}
            </p>
          </div>

          {completedItems?.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span>{item.sku}</span>
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2Icon className="mr-1 h-3 w-3" />
                        Completed
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {item.buyer_id && (
                        <span className="block">Buyer ID: {item.buyer_id}</span>
                      )}
                      <span className="block">
                        Order: #{item.order.order_number}
                        {item.order.customer_name &&
                          ` • ${item.order.customer_name}`}
                      </span>
                    </CardDescription>
                  </div>
                  <Link href={`/orders/${item.order.id}`} passHref>
                    <Button variant="outline" size="sm">
                      <ExternalLinkIcon className="mr-2 h-4 w-4" />
                      View Order
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Quantity</p>
                    <p className="font-medium">{item.total_quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="font-medium text-green-600">
                      {item.remaining_quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed At</p>
                    <p className="font-medium">{formatDate(item.updated_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Order Status</p>
                    <Badge
                      variant={
                        item.order.status === "Completed"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {item.order.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
