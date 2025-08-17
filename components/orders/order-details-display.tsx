"use client";

import { format } from "date-fns";
import { Hash, User, Calendar, Building, Clock, Zap } from "lucide-react";

// Reusing the OrderData type definition structure from the page
type OrderData = {
  id: string;
  order_number: string;
  customer_name: string | null;
  payment_status: any;
  created_at: string;
  organization_id: string;
  // Add other fields as needed
};

interface OrderDetailsDisplayProps {
  order: OrderData;
}

export default function OrderDetailsDisplay({
  order,
}: OrderDetailsDisplayProps) {
  const orderAge = Math.floor(
    (new Date().getTime() - new Date(order.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const details = [
    {
      icon: Hash,
      label: "Order Number",
      value: order.order_number,
      color: "text-primary",
    },
    {
      icon: User,
      label: "Buyer",
      value: order.customer_name || "Not specified",
      color: "text-blue-600",
    },
    {
      icon: Calendar,
      label: "Created Date",
      value: format(new Date(order.created_at), "PPP"),
      color: "text-green-600",
    },
    {
      icon: Clock,
      label: "Created Time",
      value: format(new Date(order.created_at), "p"),
      color: "text-orange-600",
    },
    {
      icon: Zap,
      label: "Order Age",
      value:
        orderAge === 0
          ? "Today"
          : orderAge === 1
            ? "1 day"
            : `${orderAge} days`,
      color:
        orderAge > 30
          ? "text-red-600"
          : orderAge > 7
            ? "text-orange-600"
            : "text-green-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {details.map((detail) => {
          const Icon = detail.icon;
          return (
            <div
              key={detail.label}
              className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/10 hover:border-accent/20 transition-colors"
            >
              <div
                className={`p-1.5 rounded-md bg-background border ${detail.color.replace("text-", "border-").replace("600", "200")}`}
              >
                <Icon className={`h-3.5 w-3.5 ${detail.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {detail.label}
                </p>
                <p className="text-sm font-medium text-foreground mt-0.5 break-all">
                  {detail.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-muted rounded">
            <Hash className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Order Summary
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Order Status:</span>
            <span className="font-medium text-primary">Active</span>
          </div>
          <div className="flex justify-between">
            <span>Priority:</span>
            <span
              className={`font-medium ${
                orderAge === 0
                  ? "text-green-600"
                  : orderAge <= 7
                    ? "text-blue-600"
                    : orderAge <= 30
                      ? "text-orange-600"
                      : "text-red-600"
              }`}
            >
              {orderAge === 0
                ? "New"
                : orderAge <= 7
                  ? "Normal"
                  : orderAge <= 30
                    ? "High"
                    : "Urgent"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
