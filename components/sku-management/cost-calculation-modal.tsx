"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, TrendingUp, RefreshCw } from "lucide-react";

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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const costCalculationSchema = z.object({
  material_cost: z.coerce.number().min(0, "Material cost must be non-negative"),
  labor_cost: z.coerce.number().min(0, "Labor cost must be non-negative"),
  overhead_percentage: z.coerce
    .number()
    .min(0)
    .max(100, "Overhead must be between 0-100%"),
  profit_margin_percentage: z.coerce
    .number()
    .min(0)
    .max(100, "Profit margin must be between 0-100%"),
  additional_costs: z.coerce
    .number()
    .min(0, "Additional costs must be non-negative")
    .optional(),
});

type CostCalculationForm = z.infer<typeof costCalculationSchema>;

interface CostCalculationModalProps {
  sku: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CostCalculationModal({
  sku,
  open,
  onOpenChange,
}: CostCalculationModalProps) {
  const [calculatedCost, setCalculatedCost] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<CostCalculationForm>({
    resolver: zodResolver(costCalculationSchema),
    defaultValues: {
      material_cost: 0,
      labor_cost: 0,
      overhead_percentage: 15,
      profit_margin_percentage: 20,
      additional_costs: 0,
    },
  });

  // Fetch existing cost data if available
  const { data: existingCost, isLoading } = useQuery({
    queryKey: ["sku-cost", sku],
    queryFn: async () => {
      const response = await fetch(`/api/cost-calculations/${sku}`);
      if (!response.ok) {
        // No existing cost data is fine
        return null;
      }
      return response.json();
    },
    enabled: open && !!sku,
  });

  // Set form values when existing cost data is loaded
  React.useEffect(() => {
    if (existingCost?.cost) {
      form.reset({
        material_cost: existingCost.cost.material_cost || 0,
        labor_cost: existingCost.cost.labor_cost || 0,
        overhead_percentage: existingCost.cost.overhead_percentage || 15,
        profit_margin_percentage:
          existingCost.cost.profit_margin_percentage || 20,
        additional_costs: existingCost.cost.additional_costs || 0,
      });
      setCalculatedCost(existingCost.cost.final_calculated_cost);
    }
  }, [existingCost, form]);

  const saveCostMutation = useMutation({
    mutationFn: async (
      data: CostCalculationForm & { final_calculated_cost: number }
    ) => {
      const response = await fetch(`/api/cost-calculations/${sku}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save cost calculation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sku-management"] });
      queryClient.invalidateQueries({ queryKey: ["sku-cost", sku] });
      toast.success("Cost calculation saved successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save cost calculation: ${error.message}`);
    },
  });

  const calculateCost = (data: CostCalculationForm) => {
    const baseCost =
      data.material_cost + data.labor_cost + (data.additional_costs || 0);
    const withOverhead = baseCost * (1 + data.overhead_percentage / 100);
    const finalCost = withOverhead * (1 + data.profit_margin_percentage / 100);

    setCalculatedCost(finalCost);
    return finalCost;
  };

  const onSubmit = (data: CostCalculationForm) => {
    const finalCost = calculateCost(data);
    saveCostMutation.mutate({
      ...data,
      final_calculated_cost: finalCost,
    });
  };

  const handleCalculate = () => {
    const data = form.getValues();
    calculateCost(data);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cost Calculation - {sku}
          </DialogTitle>
          <DialogDescription>
            Calculate the total cost for this SKU including materials, labor,
            overhead, and profit margin.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Cost Input Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Cost Components</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="material_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Cost (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="labor_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Labor Cost (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="overhead_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overhead (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="15"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Factory overhead, utilities, admin costs
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profit_margin_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profit Margin (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="20"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Desired profit margin</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="additional_costs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Costs (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Packaging, shipping, or other miscellaneous costs
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Calculate Button */}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleCalculate}
                className="w-full md:w-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Calculate Cost
              </Button>
            </div>

            {/* Cost Breakdown */}
            {calculatedCost !== null && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Cost Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Material Cost:</span>
                      <span>
                        ₹{form.getValues("material_cost")?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labor Cost:</span>
                      <span>
                        ₹{form.getValues("labor_cost")?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Additional Costs:</span>
                      <span>
                        ₹
                        {form.getValues("additional_costs")?.toFixed(2) ||
                          "0.00"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>
                        ₹
                        {(
                          (form.getValues("material_cost") || 0) +
                          (form.getValues("labor_cost") || 0) +
                          (form.getValues("additional_costs") || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        Overhead ({form.getValues("overhead_percentage")}%):
                      </span>
                      <span>
                        ₹
                        {(
                          (((form.getValues("material_cost") || 0) +
                            (form.getValues("labor_cost") || 0) +
                            (form.getValues("additional_costs") || 0)) *
                            (form.getValues("overhead_percentage") || 0)) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        Profit Margin (
                        {form.getValues("profit_margin_percentage")}%):
                      </span>
                      <span>
                        ₹
                        {(
                          calculatedCost -
                          ((form.getValues("material_cost") || 0) +
                            (form.getValues("labor_cost") || 0) +
                            (form.getValues("additional_costs") || 0)) *
                            (1 +
                              (form.getValues("overhead_percentage") || 0) /
                                100)
                        ).toFixed(2)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Final Cost per Unit:</span>
                      <span className="text-primary">
                        ₹{calculatedCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveCostMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveCostMutation.isPending || calculatedCost === null}
              >
                {saveCostMutation.isPending
                  ? "Saving..."
                  : "Save Cost Calculation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
