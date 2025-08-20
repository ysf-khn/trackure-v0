"use client";

import { useState } from "react";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Plus, History } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const updatePriceSchema = z.object({
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]),
  price_unit: z.enum(["per_piece", "per_kg", "per_dozen", "per_hundred"]),
  notes: z.string().optional(),
});

type UpdatePriceForm = z.infer<typeof updatePriceSchema>;

interface VendorPriceHistoryProps {
  vendorId: string;
  sku?: string;
  stageId?: string;
}

interface PriceHistoryEntry {
  sku: string;
  sku_name: string;
  stage_id: string;
  stage_name: string;
  stage_path: string;
  current_price: {
    price: number;
    currency: string;
    price_unit: string;
    effective_from: string;
    notes?: string;
  } | null;
  history: Array<{
    id: string;
    price: number;
    currency: string;
    price_unit: string;
    effective_from: string;
    effective_to: string | null;
    notes?: string;
    created_at: string;
    created_by: string;
  }>;
}

export function VendorPriceHistory({
  vendorId,
  sku,
  stageId,
}: VendorPriceHistoryProps) {
  const [selectedEntry, setSelectedEntry] = useState<PriceHistoryEntry | null>(
    null
  );
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-price-history", vendorId, sku, stageId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sku) params.append("sku", sku);
      if (stageId) params.append("stage_id", stageId);
      params.append("include_inactive", "true");

      const response = await fetch(
        `/api/vendors/${vendorId}/price-history?${params}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch price history");
      }
      return response.json();
    },
  });

  const form = useForm<UpdatePriceForm>({
    resolver: zodResolver(updatePriceSchema),
    defaultValues: {
      price: 0,
      currency: "INR",
      price_unit: "per_piece",
      notes: "",
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async (
      data: UpdatePriceForm & { stage_id: string; sku: string }
    ) => {
      const response = await fetch(`/api/vendors/${vendorId}/price-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update price");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-history", vendorId],
      });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(
        `Price updated successfully${data.previous_price ? ` (was ₹${data.previous_price})` : ""}`
      );
      setIsUpdateModalOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update price: ${error.message}`);
    },
  });

  const handleUpdatePrice = (entry: PriceHistoryEntry) => {
    setSelectedEntry(entry);
    form.reset({
      price: entry.current_price?.price || 0,
      currency: (entry.current_price?.currency || "INR") as any,
      price_unit: (entry.current_price?.price_unit || "per_piece") as any,
      notes: "",
    });
    setIsUpdateModalOpen(true);
  };

  const onSubmit = (data: UpdatePriceForm) => {
    if (!selectedEntry) return;

    updatePriceMutation.mutate({
      ...data,
      stage_id: selectedEntry.stage_id,
      sku: selectedEntry.sku,
    });
  };

  const formatPrice = (price: number, currency: string) => {
    const currencySymbol = currency === "INR" ? "₹" : currency;
    return `${currencySymbol}${price.toFixed(2)}`;
  };

  const formatPriceUnit = (unit: string) => {
    const units: Record<string, string> = {
      per_piece: "per piece",
      per_kg: "per kg",
      per_dozen: "per dozen",
      per_hundred: "per 100",
    };
    return units[unit] || unit;
  };

  const calculatePriceChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      percentage: Math.abs(change).toFixed(1),
      isIncrease: change > 0,
      isDecrease: change < 0,
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load price history: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const priceHistory = data?.price_history || [];

  if (priceHistory.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No price history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {priceHistory.map((entry: PriceHistoryEntry) => (
          <Card key={`${entry.sku}-${entry.stage_id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {entry.sku_name || entry.sku}
                  </CardTitle>
                  <CardDescription>{entry.stage_path}</CardDescription>
                </div>
                {entry.current_price && (
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {formatPrice(
                        entry.current_price.price,
                        entry.current_price.currency
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPriceUnit(entry.current_price.price_unit)}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {entry.current_price && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Current price since{" "}
                      {format(
                        new Date(entry.current_price.effective_from),
                        "PPP"
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdatePrice(entry)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Update Price
                    </Button>
                  </div>
                )}

                {entry.history.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Price History</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Price</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Updated By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.history.map((historyItem, index) => {
                          const previousPrice = entry.history[index + 1];
                          const priceChange = previousPrice
                            ? calculatePriceChange(
                                historyItem.price,
                                previousPrice.price
                              )
                            : null;

                          return (
                            <TableRow key={historyItem.id}>
                              <TableCell>
                                {formatPrice(
                                  historyItem.price,
                                  historyItem.currency
                                )}
                                <span className="text-xs text-muted-foreground ml-1">
                                  {formatPriceUnit(historyItem.price_unit)}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(
                                  new Date(historyItem.effective_from),
                                  "PP"
                                )}
                                {historyItem.effective_to && (
                                  <>
                                    {" "}
                                    -{" "}
                                    {format(
                                      new Date(historyItem.effective_to),
                                      "PP"
                                    )}
                                  </>
                                )}
                              </TableCell>
                              <TableCell>
                                {priceChange && (
                                  <div className="flex items-center gap-1">
                                    {priceChange.isIncrease && (
                                      <>
                                        <TrendingUp className="h-4 w-4 text-red-500" />
                                        <span className="text-sm text-red-500">
                                          +{priceChange.percentage}%
                                        </span>
                                      </>
                                    )}
                                    {priceChange.isDecrease && (
                                      <>
                                        <TrendingDown className="h-4 w-4 text-green-500" />
                                        <span className="text-sm text-green-500">
                                          -{priceChange.percentage}%
                                        </span>
                                      </>
                                    )}
                                    {!priceChange.isIncrease &&
                                      !priceChange.isDecrease && (
                                        <>
                                          <Minus className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm text-muted-foreground">
                                            No change
                                          </span>
                                        </>
                                      )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {historyItem.created_by}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Price</DialogTitle>
            <DialogDescription>
              Update the price for {selectedEntry?.sku_name} at{" "}
              {selectedEntry?.stage_name}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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

                <FormField
                  control={form.control}
                  name="price_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Unit</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="per_piece">Per Piece</SelectItem>
                          <SelectItem value="per_kg">Per Kg</SelectItem>
                          <SelectItem value="per_dozen">Per Dozen</SelectItem>
                          <SelectItem value="per_hundred">
                            Per Hundred
                          </SelectItem>
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
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this price change"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUpdateModalOpen(false)}
                  disabled={updatePriceMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePriceMutation.isPending}>
                  {updatePriceMutation.isPending
                    ? "Updating..."
                    : "Update Price"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
