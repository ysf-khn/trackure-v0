"use client";

import { format } from "date-fns";

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
      <div>
        <p className="font-medium text-muted-foreground">Order Number</p>
        <p>{order.order_number}</p>
      </div>
      <div>
        <p className="font-medium text-muted-foreground">Customer Name</p>
        <p>{order.customer_name || "N/A"}</p>
      </div>
      <div>
        <p className="font-medium text-muted-foreground">Created Date</p>
        <p>
          {format(
            new Date(order.created_at),
            "PPP p" // e.g., Sep 21, 2023 4:30 PM
          )}
        </p>
      </div>
      {/* Payment status is handled separately below this component in the page */}
      {/* Add other order fields here as needed */}
    </div>
  );
}
