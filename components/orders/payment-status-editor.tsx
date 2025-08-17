"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

const getStatusConfig = (status: PaymentStatus | null) => {
  switch (status) {
    case "Paid":
      return {
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/20",
        label: "Paid",
      };
    case "Credit":
      return {
        icon: CreditCard,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/20",
        label: "Credit",
      };
    case "Lent":
      return {
        icon: Clock,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/20",
        label: "Lent",
      };
    default:
      return {
        icon: AlertCircle,
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        borderColor: "border-gray-500/20",
        label: "Not Set",
      };
  }
};

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

  const statusConfig = getStatusConfig(currentStatus ?? null);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-3">
      {/* Status Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Update Status
        </label>
        <Select
          onValueChange={handleStatusChange}
          value={currentStatus ?? ""}
          disabled={mutation.isPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose payment status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Paid">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Paid</span>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                  Complete
                </Badge>
              </div>
            </SelectItem>
            <SelectItem value="Credit">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span>Credit</span>
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
                  Extended
                </Badge>
              </div>
            </SelectItem>
            <SelectItem value="Lent">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span>Lent</span>
                <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
                  Pending
                </Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
