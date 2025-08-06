"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { DollarSign, Calendar, FileText, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const paymentSchema = z.object({
  payment_type: z.enum(["advance", "part_payment", "force_closure", "closure"]),
  amount_paid: z.number().min(0, "Amount must be non-negative"),
  payment_date: z.string().optional(),
  remarks: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

interface VendorPaymentModalProps {
  vendorId: string;
  order: {
    id: string;
    order_number: string;
    sku: string;
    total_amount: number;
    currency: string;
    payment_summary: {
      total_paid: number;
      remaining_amount: number;
      payment_status: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorPaymentModal({
  vendorId,
  order,
  open,
  onOpenChange,
}: VendorPaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>("");

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_type: "part_payment",
      amount_paid: 0,
      payment_date: new Date().toISOString().split("T")[0],
      remarks: "",
    },
  });

  const remainingAmount = order.payment_summary.remaining_amount;

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      const response = await fetch(`/api/vendors/${vendorId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          vendor_order_id: order.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to record payment");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-payments", vendorId] });
      toast.success(
        data.order_summary.payment_complete
          ? "Payment completed successfully"
          : "Payment recorded successfully"
      );
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });

  const onSubmit = (data: PaymentForm) => {
    createPaymentMutation.mutate(data);
  };

  const formatCurrency = (amount: number) => {
    const symbol = order.currency === "INR" ? "₹" : order.currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  // Update amount when payment type changes
  const handlePaymentTypeChange = (value: string) => {
    setSelectedPaymentType(value);
    if (value === "closure") {
      form.setValue("amount_paid", remainingAmount);
    }
  };

  const getPaymentTypeDescription = (type: string) => {
    switch (type) {
      case "advance":
        return "Payment made in advance before order completion";
      case "part_payment":
        return "Partial payment towards this order";
      case "force_closure":
        return "Close the order with partial payment (write-off remaining amount)";
      case "closure":
        return "Full and final payment to close the order";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for order {order.order_number}
          </DialogDescription>
        </DialogHeader>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Order Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(order.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Already Paid</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(order.payment_summary.total_paid)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining Amount</p>
                <p className="text-lg font-semibold text-destructive">
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SKU</p>
                <p className="text-lg font-semibold">{order.sku}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="payment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handlePaymentTypeChange(value);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="advance">Advance Payment</SelectItem>
                      <SelectItem value="part_payment">Part Payment</SelectItem>
                      <SelectItem value="force_closure">Force Closure</SelectItem>
                      <SelectItem value="closure">Full Closure</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedPaymentType && (
                    <FormDescription>
                      {getPaymentTypeDescription(selectedPaymentType)}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount_paid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-10"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        disabled={form.watch("payment_type") === "closure"}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                  {form.watch("amount_paid") > remainingAmount && (
                    <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Amount exceeds remaining balance
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this payment (e.g., payment method, reference number)"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Internal notes for tracking purposes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">New Balance After Payment:</span>
              <span className="font-semibold">
                {formatCurrency(Math.max(0, remainingAmount - (form.watch("amount_paid") || 0)))}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createPaymentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPaymentMutation.isPending}
              >
                {createPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}