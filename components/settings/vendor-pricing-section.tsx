"use client";

import React from "react";
import { useFieldArray, Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusIcon, TrashIcon, DollarSignIcon } from "lucide-react";
import { useVendors } from "@/hooks/queries/use-vendors";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface VendorPricingData {
  vendor_id: string;
  price: number;
  currency: string;
  price_unit: string;
  minimum_quantity: number;
  lead_time_days: number;
  notes: string;
}

interface VendorPricingSectionProps {
  control: Control<any>;
  selectedSKU: string | null;
  isLeafStage: boolean;
}

export function VendorPricingSection({
  control,
  selectedSKU,
  isLeafStage,
}: VendorPricingSectionProps) {
  const { data: vendorsData, isLoading: vendorsLoading } = useVendors();
  const vendors = vendorsData?.vendors || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: "vendorPricing",
  });

  // Don't show vendor pricing for non-leaf stages or when no SKU is selected
  if (!isLeafStage || !selectedSKU) {
    return null;
  }

  const addVendorPricing = () => {
    append({
      vendor_id: "",
      price: 0,
      currency: "INR",
      price_unit: "per_piece",
      minimum_quantity: 1,
      lead_time_days: 0,
      notes: "",
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Vendor Pricing</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVendorPricing}
            disabled={vendorsLoading || vendors.length === 0}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
        {selectedSKU && (
          <p className="text-sm text-muted-foreground">
            Configure vendor pricing for SKU: <span className="font-mono font-medium">{selectedSKU}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {vendorsLoading && (
          <Alert>
            <AlertDescription>Loading vendors...</AlertDescription>
          </Alert>
        )}

        {!vendorsLoading && vendors.length === 0 && (
          <Alert>
            <AlertDescription>
              No vendors available. Please add vendors first to configure pricing.
            </AlertDescription>
          </Alert>
        )}

        {fields.length === 0 && vendors.length > 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <DollarSignIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vendor pricing configured</p>
            <p className="text-xs">Click "Add Vendor" to set up pricing for this stage</p>
          </div>
        )}

        {fields.map((field, index) => (
          <Card key={field.id} className="border-border/50">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Vendor {index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name={`vendorPricing.${index}.vendor_id`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors
                            .filter((vendor) => vendor.is_active)
                            .map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                                {vendor.firm_name && (
                                  <span className="text-muted-foreground ml-1">
                                    ({vendor.firm_name})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`vendorPricing.${index}.price`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`vendorPricing.${index}.currency`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  control={control}
                  name={`vendorPricing.${index}.price_unit`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="per_piece">Per Piece</SelectItem>
                          <SelectItem value="per_kg">Per KG</SelectItem>
                          <SelectItem value="per_dozen">Per Dozen</SelectItem>
                          <SelectItem value="per_hundred">Per Hundred</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`vendorPricing.${index}.minimum_quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`vendorPricing.${index}.lead_time_days`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Time (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={control}
                name={`vendorPricing.${index}.notes`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Special instructions or notes for this vendor..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}