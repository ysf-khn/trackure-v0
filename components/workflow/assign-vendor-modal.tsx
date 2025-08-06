"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building, Package, DollarSign, Calendar } from "lucide-react";

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

const assignVendorSchema = z.object({
  vendor_id: z.string().uuid("Please select a vendor"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  expected_completion: z.string().optional(),
  notes: z.string().optional(),
});

type AssignVendorForm = z.infer<typeof assignVendorSchema>;

interface AssignVendorModalProps {
  itemId: string;
  allocationId: string;
  sku: string;
  stageId: string;
  stageName: string;
  availableQuantity: number;
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
  open,
  onOpenChange,
}: AssignVendorModalProps) {
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<string>("");

  const form = useForm<AssignVendorForm>({
    resolver: zodResolver(assignVendorSchema),
    defaultValues: {
      vendor_id: "",
      quantity: availableQuantity,
      unit_price: 0,
      currency: "INR",
      expected_completion: "",
      notes: "",
    },
  });

  // Fetch available vendors for this stage and SKU
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendor-pricing", stageId, sku],
    queryFn: async () => {
      const response = await fetch(`/api/vendor-pricing?stage_id=${stageId}&sku=${sku}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor pricing");
      }
      return response.json();
    },
    enabled: open,
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
          quantity: data.quantity,
          unit_price: data.unit_price,
          currency: data.currency,
          stage_id: stageId,
          item_id: itemId,
          allocation_id: allocationId,
          expected_completion: data.expected_completion,
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
      toast.success(`Vendor assigned successfully. Order: ${data.order_number}`);
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
    
    // Find the selected vendor's pricing
    const vendorPricing = vendorsData?.find((v: any) => v.vendor_id === vendorId);
    if (vendorPricing) {
      form.setValue("unit_price", vendorPricing.pricing_per_unit);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === "INR" ? "₹" : currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const totalAmount = (form.watch("quantity") || 0) * (form.watch("unit_price") || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assign Vendor</DialogTitle>
          <DialogDescription>
            Assign a vendor to handle {sku} at {stageName} stage
          </DialogDescription>
        </DialogHeader>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">SKU</p>
                <p className="font-semibold">{sku}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stage</p>
                <p className="font-semibold">{stageName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Quantity</p>
                <p className="font-semibold">{availableQuantity} pieces</p>
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
                        <SelectItem value="" disabled>
                          Loading vendors...
                        </SelectItem>
                      ) : vendorsData?.length === 0 ? (
                        <SelectItem value="" disabled>
                          No vendors available for this stage
                        </SelectItem>
                      ) : (
                        vendorsData?.map((vendor: any) => (
                          <SelectItem key={vendor.vendor_id} value={vendor.vendor_id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{vendor.vendor_name}</span>
                              <Badge variant="outline" className="ml-2">
                                {formatCurrency(vendor.pricing_per_unit, vendor.currency)}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          className="pl-10"
                          max={availableQuantity}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          className="pl-10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <FormField
                control={form.control}
                name="expected_completion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Completion</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any special instructions or notes for this vendor order"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total Order Value:</span>
              <span className="text-primary">
                {formatCurrency(totalAmount, form.watch("currency"))}
              </span>
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
              <Button
                type="submit"
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? "Assigning..." : "Assign Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}