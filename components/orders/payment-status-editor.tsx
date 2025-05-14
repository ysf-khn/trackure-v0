"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentStatus } from "@/types";

interface PaymentStatusEditorProps {
  orderId: string;
  initialStatus: PaymentStatus | undefined; // Use undefined for uncontrolled default
}

// API call function
async function updatePaymentStatusAPI({
  orderId,
  payment_status,
}: {
  orderId: string;
  payment_status: PaymentStatus;
}) {
  const response = await fetch(`/api/orders/${orderId}/payment-status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payment_status }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update payment status");
  }

  return response.json();
}

export default function PaymentStatusEditor({
  orderId,
  initialStatus,
}: PaymentStatusEditorProps) {
  const queryClient = useQueryClient();
  // Local state to manage the select value before saving
  const [currentStatus, setCurrentStatus] = useState<PaymentStatus | undefined>(
    initialStatus
  );

  const mutation = useMutation({
    mutationFn: updatePaymentStatusAPI,
    onSuccess: () => {
      toast.success("Payment status updated successfully!");
      // Invalidate queries using simple array keys
      queryClient.invalidateQueries({ queryKey: ["order", orderId] }); // Key for specific order
      queryClient.invalidateQueries({ queryKey: ["orders"] }); // Key for orders list
    },
    onError: (error) => {
      console.error("Update failed:", error);
      toast.error(`Update failed: ${error.message}`);
      setCurrentStatus(initialStatus);
    },
  });

  const handleStatusChange = (value: string) => {
    const newStatus = value as PaymentStatus;
    setCurrentStatus(newStatus);
    mutation.mutate({ orderId, payment_status: newStatus });
  };

  return (
    <div className="flex items-center space-x-2">
      <Select
        onValueChange={handleStatusChange}
        value={currentStatus ?? ""}
        disabled={mutation.isPending}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Set status..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Lent">Lent</SelectItem>
          <SelectItem value="Credit">Credit</SelectItem>
          <SelectItem value="Paid">Paid</SelectItem>
        </SelectContent>
      </Select>
      {mutation.isPending && (
        <span className="text-sm text-muted-foreground">Updating...</span>
      )}
    </div>
  );
}
