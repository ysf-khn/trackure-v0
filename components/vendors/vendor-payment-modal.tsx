"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  Upload,
  X,
  Image,
} from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";

const paymentSchema = z
  .object({
    payment_type: z.enum([
      "advance",
      "part_payment",
      "force_closure",
      "closure",
    ]),
    amount_paid: z.number().min(0, "Amount must be non-negative"),
    payment_date: z.string().optional(),
    remarks: z.string().optional(),
  })
  .refine(
    (data) => {
      // Remarks required for force_closure
      if (data.payment_type === "force_closure" && !data.remarks) {
        return false;
      }
      return true;
    },
    {
      message: "Remarks are required for force closure",
      path: ["remarks"],
    }
  );

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

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

  // File upload handlers
  const handleFileSelect = (file: File) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error("Please select an image or PDF file");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setUploadPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setUploadPreview(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadPreview(null);
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      // First create the payment
      const paymentResponse = await fetch(`/api/vendors/${vendorId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_type: data.payment_type,
          amount_paid: data.amount_paid,
          payment_date: data.payment_date
            ? new Date(data.payment_date).toISOString()
            : new Date().toISOString(),
          remarks: data.remarks,
          vendor_order_id: order.id,
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.error || "Failed to record payment");
      }

      const paymentResult = await paymentResponse.json();

      // If there's a file, upload it
      if (selectedFile && paymentResult.payment) {
        try {
          // Get presigned upload URL
          const uploadUrlResponse = await fetch("/api/upload/presigned-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: selectedFile.name,
              contentType: selectedFile.type,
              type: "vendor-payment",
              entityId: paymentResult.payment.id,
            }),
          });

          if (!uploadUrlResponse.ok) {
            throw new Error("Failed to get upload URL");
          }

          const { uploadUrl, s3Key } = await uploadUrlResponse.json();

          // Upload file to S3
          const s3Response = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": selectedFile.type },
            body: selectedFile,
          });

          if (!s3Response.ok) {
            throw new Error("Failed to upload file");
          }

          // Associate receipt with payment
          const receiptResponse = await fetch(
            `/api/vendors/payments/${paymentResult.payment.id}/receipts`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                s3Key,
                fileName: selectedFile.name,
                fileSizeBytes: selectedFile.size,
                contentType: selectedFile.type,
              }),
            }
          );

          if (!receiptResponse.ok) {
            console.error("Failed to associate receipt with payment");
            // Don't fail the whole operation for receipt upload issues
          }
        } catch (uploadError) {
          console.error("Error uploading receipt:", uploadError);
          toast.error("Payment recorded but receipt upload failed");
        }
      }

      return paymentResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders", vendorId] });
      queryClient.invalidateQueries({
        queryKey: ["vendor-payments", vendorId],
      });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      toast.success(
        data.order_summary.payment_complete
          ? "Payment completed successfully"
          : "Payment recorded successfully"
      );
      form.reset();
      setSelectedFile(null);
      setUploadPreview(null);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for order {order.order_number}
          </DialogDescription>
        </DialogHeader>
        
        {/* Temporary restriction notice */}
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm text-yellow-800">
            <strong>Note:</strong> Currently, only one payment per order is allowed. Once you record this payment, you won't be able to add additional payments to this order.
          </AlertDescription>
        </Alert>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Order Amount</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(order.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Already Paid</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(order.payment_summary.total_paid)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Remaining Amount
                </p>
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
                      <SelectItem value="force_closure">
                        Force Closure
                      </SelectItem>
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
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                        disabled={form.watch("payment_type") === "closure"}
                      />
                    </div>
                  </FormControl>
                  {form.watch("payment_type") !== "closure" && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          form.setValue("amount_paid", remainingAmount * 0.25)
                        }
                      >
                        25%
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          form.setValue("amount_paid", remainingAmount * 0.5)
                        }
                      >
                        50%
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          form.setValue("amount_paid", remainingAmount * 0.75)
                        }
                      >
                        75%
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          form.setValue("amount_paid", remainingAmount)
                        }
                      >
                        Full
                      </Button>
                    </div>
                  )}
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
                      <Input type="date" className="pl-10" {...field} />
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
                  <FormLabel>
                    Remarks{" "}
                    {form.watch("payment_type") === "force_closure" && (
                      <span className="text-destructive">*</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        form.watch("payment_type") === "force_closure"
                          ? "Explain reason for force closure (required)"
                          : "Add any notes about this payment (e.g., payment method, reference number)"
                      }
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {form.watch("payment_type") === "force_closure"
                      ? "Required: Explain why the order is being closed with partial payment"
                      : "Internal notes for tracking purposes"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Receipt Upload Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Receipt Upload (Optional)
              </label>
              <div className="space-y-4">
                {!selectedFile ? (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                    onClick={() =>
                      document.getElementById("receipt-upload")?.click()
                    }
                  >
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload receipt or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Images or PDF files up to 10MB
                    </p>
                    <input
                      id="receipt-upload"
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {uploadPreview ? (
                          <img
                            src={uploadPreview}
                            alt="Receipt preview"
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                            <FileText className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Upload a receipt or proof of payment
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                New Balance After Payment:
              </span>
              <span className="font-semibold">
                {formatCurrency(
                  Math.max(
                    0,
                    remainingAmount - (form.watch("amount_paid") || 0)
                  )
                )}
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
              <Button type="submit" disabled={createPaymentMutation.isPending}>
                {createPaymentMutation.isPending
                  ? "Recording..."
                  : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
