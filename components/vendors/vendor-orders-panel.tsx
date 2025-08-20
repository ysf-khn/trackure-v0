"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { VendorPaymentModal } from "./vendor-payment-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VendorOrdersPanelProps {
  vendorId: string;
}

interface VendorOrder {
  id: string;
  order_number: string;
  customer_order_number: string;
  customer_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  expected_completion?: string;
  actual_completion?: string;
  created_at: string;
  stage: {
    name: string;
    full_path: string;
  };
  sku_details?: {
    master_details?: {
      name?: string;
    };
  };
  payment_summary: {
    total_paid: number;
    remaining_amount: number;
    payment_status: "paid" | "partial" | "unpaid";
    payment_count: number;
    has_carryforward: boolean;
    last_payment_type?: string | null;
    last_payment_remarks?: string | null;
  };
}

export function VendorOrdersPanel({ vendorId }: VendorOrdersPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-orders", vendorId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      params.append("include_payments", "true");

      const response = await fetch(`/api/vendors/${vendorId}/orders?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor orders");
      }
      return response.json();
    },
  });

  const handleAddPayment = (order: VendorOrder) => {
    setSelectedOrder(order);
    setIsPaymentModalOpen(true);
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === "INR" ? "₹" : currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "in_progress":
        return <AlertCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pending":
        return "secondary";
      case "in_progress":
        return "default";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "default";
    }
  };

  const getPaymentStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "paid":
        return "default";
      case "partial":
        return "secondary";
      case "unpaid":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load vendor orders: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const orders = data?.orders || [];
  const summary = data?.summary || {};

  // Calculate outstanding payment from orders if not available in summary
  const outstandingPayment =
    summary.outstanding_payment ||
    orders.reduce((total: number, order: VendorOrder) => {
      return total + (order.payment_summary?.remaining_amount || 0);
    }, 0);

  return (
    <>
      <div className="space-y-6">
        {/* Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Orders</CardTitle>
                <CardDescription>
                  Track all orders placed with this vendor
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No orders found</p>
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Assigned Stage</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price per Unit</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: VendorOrder) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {order.customer_order_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.customer_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.sku}</p>
                            {order.sku_details?.master_details?.name && (
                              <p className="text-sm text-muted-foreground">
                                {order.sku_details.master_details.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.stage.name}
                        </TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>
                          {formatCurrency(order.unit_price, order.currency)}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {formatCurrency(order.total_amount, order.currency)}
                          </p>
                        </TableCell>
                        <TableCell>
                          {order.payment_summary.payment_status === "paid" ? (
                            <div className="space-y-1">
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-700 hover:bg-green-100"
                              >
                                Paid
                              </Badge>
                              {order.payment_summary.last_payment_type && (
                                <div className="text-xs space-y-0.5">
                                  <p className="text-muted-foreground">
                                    Type:{" "}
                                    {order.payment_summary.last_payment_type}
                                  </p>
                                  {order.payment_summary
                                    .last_payment_remarks && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <p className="text-muted-foreground truncate max-w-[150px]">
                                          {
                                            order.payment_summary
                                              .last_payment_remarks
                                          }
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs">
                                          {
                                            order.payment_summary
                                              .last_payment_remarks
                                          }
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge
                                variant={getPaymentStatusVariant(
                                  order.payment_summary.payment_status
                                )}
                              >
                                {order.payment_summary.payment_status ===
                                "partial"
                                  ? "Partial"
                                  : "Unpaid"}
                              </Badge>
                              {order.payment_summary.remaining_amount > 0 && (
                                <p className="text-xs text-destructive font-medium">
                                  Due:{" "}
                                  {formatCurrency(
                                    order.payment_summary.remaining_amount,
                                    order.currency
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), "PP")}
                        </TableCell>
                        <TableCell>
                          {order.payment_summary.payment_status !== "paid" &&
                            order.payment_summary.payment_count === 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddPayment(order)}
                              >
                                Add Payment
                              </Button>
                            )}
                          {order.payment_summary.payment_count > 0 &&
                            order.payment_summary.payment_status !== "paid" && (
                              <div className="text-sm text-muted-foreground">
                                Payment recorded
                              </div>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedOrder && (
        <VendorPaymentModal
          vendorId={vendorId}
          order={selectedOrder}
          open={isPaymentModalOpen}
          onOpenChange={setIsPaymentModalOpen}
        />
      )}
    </>
  );
}
