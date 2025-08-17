"use client";

import { format } from "date-fns";
import {
  ChevronRight,
  Package,
  Calendar,
  User,
  CreditCard,
  Download,
  Share2,
  MoreHorizontal,
  Hash,
  Clock,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentStatus } from "@/types";
import PaymentStatusEditor from "@/components/orders/payment-status-editor";

interface OrderHeaderProps {
  order: {
    id: string;
    order_number: string;
    customer_name: string | null;
    payment_status: PaymentStatus | null;
    created_at: string;
  };
  canExport?: boolean;
  canEditPaymentStatus?: boolean;
}

const getPaymentStatusColor = (status: PaymentStatus | null) => {
  switch (status) {
    case "Paid":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "Credit":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Lent":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

const getPaymentStatusIcon = (status: PaymentStatus | null) => {
  switch (status) {
    case "Paid":
      return "✓";
    case "Credit":
      return "↻";
    case "Lent":
      return "⏳";
    default:
      return "−";
  }
};

export function OrderHeader({
  order,
  canExport = true,
  canEditPaymentStatus = false,
}: OrderHeaderProps) {
  const orderAge = Math.floor(
    (new Date().getTime() - new Date(order.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const getPriorityLabel = () => {
    if (orderAge === 0) return { label: "New", color: "text-green-500" };
    if (orderAge <= 7) return { label: "Normal", color: "text-blue-500" };
    if (orderAge <= 30) return { label: "High", color: "text-orange-500" };
    return { label: "Urgent", color: "text-red-500" };
  };

  const priority = getPriorityLabel();

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />

      <div className="relative space-y-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href="/orders"
            className="hover:text-foreground transition-colors"
          >
            Orders
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">
            {order.order_number}
          </span>
        </nav>

        {/* Main Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            {/* Title and badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">
                Order {order.order_number}
              </h1>
              <Badge className={getPaymentStatusColor(order.payment_status)}>
                <span className="mr-1">
                  {getPaymentStatusIcon(order.payment_status)}
                </span>
                {order.payment_status || "No Payment Status"}
              </Badge>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {canExport && (
              <>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Share
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <CreditCard className="h-4 w-4 mr-2" />
                  View Invoice
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Package className="h-4 w-4 mr-2" />
                  Duplicate Order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
            <div className="p-2 bg-primary/10 rounded">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Buyer
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {order.customer_name || "Not specified"}
              </p>
            </div>
          </div>

          {/* Created Date */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
            <div className="p-2  rounded">
              <Calendar className="h-4 w-4 text-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Created Date
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {format(new Date(order.created_at), "PPP")}
              </p>
            </div>
          </div>

          {/* Created Time */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
            <div className="p-2  rounded">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Created Time
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {format(new Date(order.created_at), "p")}
              </p>
            </div>
          </div>

          {/* Order Age */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
            <div
              className={`p-2 rounded ${priority.color.replace("text-", "bg-").replace("500", "500/10")}`}
            >
              <Zap className={`h-4 w-4 ${priority.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Order Age
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {orderAge === 0
                  ? "Today"
                  : orderAge === 1
                    ? "1 day"
                    : `${orderAge} days`}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Status Section */}
        {canEditPaymentStatus && (
          <div className="border-t pt-4">
            <PaymentStatusEditor
              orderId={order.id}
              initialStatus={order.payment_status ?? undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
