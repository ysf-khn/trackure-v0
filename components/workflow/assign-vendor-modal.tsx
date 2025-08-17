"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building,
  Package,
  DollarSign,
  Calendar,
  AlertTriangle,
  History,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const assignVendorSchema = z.object({
  vendor_id: z.string().uuid("Please select a vendor"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  notes: z.string().optional(),
});

type AssignVendorForm = z.infer<typeof assignVendorSchema>;

interface AssignVendorModalProps {
  itemId?: string; // Optional - not available when assigning from settings
  allocationId?: string; // Optional - not available when assigning from settings
  sku: string;
  stageId: string;
  stageName: string;
  availableQuantity?: number; // Optional - will be fetched from order context
  orderId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignVendorModal({
  itemId,
  allocationId,
  sku,
  stageId,
  stageName,
  availableQuantity,
  orderId,
  open,
  onOpenChange,
}: AssignVendorModalProps) {
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  // Get organization ID from existing hook
  const { organizationId } = useProfileAndOrg();

  const form = useForm<AssignVendorForm>({
    resolver: zodResolver(assignVendorSchema),
    defaultValues: {
      vendor_id: "",
      unit_price: 0,
      currency: "INR",
      notes: "",
    },
  });

  // Fetch vendors with SKU context for better selection
  const { data: vendorsResponse, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors-sku-context", sku, stageId, organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization not found");
      const response = await fetch(`/api/vendors/sku-context?sku=${sku}&stage_id=${stageId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendors");
      }
      return response.json();
    },
    enabled: open && !!organizationId && !!sku && !!stageId,
  });

  // Extract vendors array from response
  const vendorsData = vendorsResponse?.vendors || [];

  // Fetch order context immediately when modal opens (if orderId exists)
  const { data: orderContext, isLoading: orderContextLoading } = useQuery({
    queryKey: ["order-context", sku, stageId, orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const params = new URLSearchParams({
        sku: sku,
        stage_id: stageId,
        order_id: orderId,
      });

      const response = await fetch(`/api/vendors/order-context?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch order context");
      }
      return response.json();
    },
    enabled: open && !!orderId,
  });

  // Fetch vendor-specific context when a vendor is selected
  const { data: vendorContext, isLoading: contextLoading } = useQuery({
    queryKey: ["vendor-context", selectedVendor, sku, stageId],
    queryFn: async () => {
      const params = new URLSearchParams({
        vendor_id: selectedVendor,
        sku: sku,
        stage_id: stageId,
      });

      const response = await fetch(`/api/vendors/assignment-context?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor context");
      }
      return response.json();
    },
    enabled: open && !!selectedVendor,
  });

  // Get selected vendor context for displaying history
  const selectedVendorContext = vendorsData?.find((v: any) => v.id === selectedVendor)?.context;

  // Calculate display quantity first
  const displayQuantity =
    orderContext?.total_quantity_for_sku ||
    vendorContext?.order_context?.total_quantity_for_sku ||
    availableQuantity ||
    0;

  // Debug logging
  console.log("AssignVendorModal Debug:", {
    orderId,
    selectedVendor,
    orderContext,
    selectedVendorContext,
    displayQuantity,
    availableQuantity,
    vendorsDataCount: vendorsData?.length || 0,
  });

  // Create vendor order
  const createOrderMutation = useMutation({
    mutationFn: async (data: AssignVendorForm) => {
      const response = await fetch(`/api/vendors/${data.vendor_id}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku,
          quantity: displayQuantity,
          unit_price: data.unit_price,
          currency: data.currency,
          stage_id: stageId,
          item_id: itemId || undefined,
          allocation_id: allocationId || undefined,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign vendor");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
      toast.success(
        `Vendor assigned successfully. Order: ${data.order_number}`
      );
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign vendor: ${error.message}`);
    },
  });

  const onSubmit = (data: AssignVendorForm) => {
    createOrderMutation.mutate(data);
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendor(vendorId);
    // No auto-filling of prices - users must enter price manually
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === "INR" ? "₹" : currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const unitPrice = form.watch("unit_price") || 0;
  const totalAmount = displayQuantity * unitPrice;
  const outstandingAmount = selectedVendorContext?.outstanding_amount || 0;
  const grandTotal = totalAmount + outstandingAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Vendor to {stageName}</DialogTitle>
          <DialogDescription>
            Configure vendor assignment for{" "}
            {orderContext?.sku_name || vendorContext?.order_context?.sku_name || sku}
          </DialogDescription>
        </DialogHeader>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">SKU</p>
                <p className="font-semibold">
                  {orderContext?.sku_name || vendorContext?.order_context?.sku_name || sku}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stage</p>
                <p className="font-semibold">{stageName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Quantity</p>
                <p className="font-semibold">{displayQuantity} pieces</p>
                {(orderContext?.customer_name || vendorContext?.order_context?.customer_name) && (
                  <p className="text-xs text-muted-foreground">
                    {orderContext?.customer_name || vendorContext?.order_context?.customer_name}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Estimated</p>
                <p className="font-semibold text-primary">
                  {formatCurrency(totalAmount, form.watch("currency"))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleVendorChange(value);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendorsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading vendors...
                        </SelectItem>
                      ) : vendorsData?.length === 0 ? (
                        <SelectItem value="no-vendors" disabled>
                          No vendors available
                        </SelectItem>
                      ) : (
                        vendorsData?.map((vendor: any) => {
                          const lastPrice = vendor.context?.current_pricing?.price || 
                                          vendor.context?.price_history?.[0]?.price;
                          const lastCurrency = vendor.context?.current_pricing?.currency || 
                                             vendor.context?.price_history?.[0]?.currency || "INR";
                          const hasWorkedBefore = vendor.context?.has_worked_before;
                          const outstandingAmount = vendor.context?.outstanding_amount || 0;

                          return (
                            <SelectItem
                              key={vendor.id}
                              value={vendor.id}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{vendor.name}</span>
                                    {hasWorkedBefore && (
                                      <Badge variant="secondary" className="text-xs">
                                        Worked before
                                      </Badge>
                                    )}
                                    {outstandingAmount > 0 && (
                                      <Badge variant="destructive" className="text-xs">
                                        Outstanding: {formatCurrency(outstandingAmount, "INR")}
                                      </Badge>
                                    )}
                                  </div>
                                  {vendor.firm_name && (
                                    <span className="text-xs text-muted-foreground">
                                      {vendor.firm_name}
                                    </span>
                                  )}
                                  {lastPrice && (
                                    <span className="text-xs text-muted-foreground">
                                      Last price: {formatCurrency(lastPrice, lastCurrency)}/piece
                                    </span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Outstanding Amount Alert */}
            {selectedVendor && outstandingAmount > 0 && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900">
                  This vendor has an outstanding balance of{" "}
                  {formatCurrency(outstandingAmount, "INR")}
                  which will be added to this order.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Piece</FormLabel>
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
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Notes</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Rush order, Bulk discount, Special material"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price History Section */}
            {selectedVendor &&
              selectedVendorContext?.price_history &&
              selectedVendorContext.price_history.length > 0 && (
                <Collapsible
                  open={showPriceHistory}
                  onOpenChange={setShowPriceHistory}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex items-center justify-between w-full p-2"
                    >
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Previous Prices
                        </span>
                      </div>
                      {showPriceHistory ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {selectedVendorContext.price_history.map(
                      (history: any, index: number) => (
                        <div
                          key={index}
                          className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{history.date}</span>
                            <Badge variant="secondary">
                              {formatCurrency(
                                history.price,
                                history.currency || "INR"
                              )}{" "}
                              / {history.price_unit || "piece"}
                            </Badge>
                          </div>
                          {history.notes && (
                            <span className="text-xs text-muted-foreground italic">
                              {history.notes}
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

            {/* Payment History Section */}
            {selectedVendor &&
              selectedVendorContext?.recent_payments &&
              selectedVendorContext.recent_payments.length > 0 && (
                <Collapsible
                  open={showPaymentHistory}
                  onOpenChange={setShowPaymentHistory}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex items-center justify-between w-full p-2"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Recent Payments
                        </span>
                      </div>
                      {showPaymentHistory ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {selectedVendorContext.recent_payments.map(
                      (payment: any, index: number) => (
                        <div
                          key={index}
                          className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  payment.type === "closure"
                                    ? "default"
                                    : payment.type === "advance"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {payment.type.replace("_", " ")}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {payment.date}
                              </span>
                            </div>
                            <span className="text-sm font-medium">
                              {formatCurrency(payment.amount, "INR")}
                            </span>
                          </div>
                          {payment.remarks && (
                            <span className="text-xs text-muted-foreground">
                              {payment.remarks}
                            </span>
                          )}
                          {payment.sku && (
                            <span className="text-xs text-muted-foreground">
                              SKU: {payment.sku} | Order: {payment.order_number}
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Order Amount:</span>
                <span className="font-medium">
                  {formatCurrency(totalAmount, form.watch("currency"))}
                </span>
              </div>
              {outstandingAmount > 0 && (
                <>
                  <div className="flex items-center justify-between text-orange-600">
                    <span>Outstanding Balance:</span>
                    <span className="font-medium">
                      +{formatCurrency(outstandingAmount, "INR")}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Grand Total:</span>
                    <span className="text-primary">
                      {formatCurrency(grandTotal, form.watch("currency"))}
                    </span>
                  </div>
                </>
              )}
              {outstandingAmount === 0 && (
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total Order Value:</span>
                  <span className="text-primary">
                    {formatCurrency(totalAmount, form.watch("currency"))}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createOrderMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending
                  ? "Assigning..."
                  : "Assign Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
