"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  PackageOpenIcon,
  Package,
  ChevronsUpDown,
  Check,
  FileText,
  Building2,
  PackageIcon,
  DollarSignIcon,
  CheckCircle2Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Hooks
import { useOrders } from "@/hooks/queries/use-orders";
import { useOrderSelection } from "@/contexts/order-selection-context";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import { useOrderSKUs } from "@/hooks/queries/use-order-skus";
import { useSKUs } from "@/hooks/queries/use-skus";
import { useSidebarSkuCost } from "@/hooks/queries/use-sidebar-sku-cost";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

const getCurrencySymbol = (currency: string) => {
  switch (currency) {
    case 'INR': return '₹';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'Mixed': return '';
    default: return currency;
  }
};

export function OrderContextSection() {
  const pathname = usePathname();
  const { organizationId } = useProfileAndOrg();

  // Order selection
  const {
    selectedOrderId,
    setSelectedOrderId,
    selectedOrderNumber,
    setSelectedOrderNumber,
    clearOrderSelection,
  } = useOrderSelection();
  const [orderSelectorOpen, setOrderSelectorOpen] = useState(false);

  // SKU selection  
  const { selectedSKU, setSelectedSKU } = useSKUSelection();
  const [skuSelectorOpen, setSKUSelectorOpen] = useState(false);

  // Data fetching
  const { data: ordersData, isLoading: isLoadingOrders } = useOrders(organizationId);
  const { data: allSkuData, isLoading: isLoadingAllSKUs } = useSKUs();
  const { data: orderSkuData, isLoading: isLoadingOrderSKUs } = useOrderSKUs(organizationId, selectedOrderId);
  const { data: costData, isLoading: isLoadingCost } = useSidebarSkuCost(
    organizationId,
    selectedSKU,
    selectedOrderId
  );

  // Data processing
  const skuData = selectedOrderId ? orderSkuData : allSkuData;
  const isLoadingSKUs = selectedOrderId ? isLoadingOrderSKUs : isLoadingAllSKUs;

  const availableOrders = React.useMemo(() => {
    if (!ordersData) return [];
    return ordersData.map((order) => ({
      value: order.id,
      label: order.order_number,
      customerName: order.customer_name,
      totalQuantity: order.total_quantity,
      skuCount: order.skus?.length || 0,
      status: order.status,
    }));
  }, [ordersData]);

  const availableSKUs = React.useMemo(() => {
    if (selectedOrderId) {
      if (!orderSkuData) return [];
      return orderSkuData.map((item) => ({
        value: item.sku,
        label: item.sku_name || item.sku,
        completedQuantity: item.completed_quantity,
        totalQuantity: item.total_quantity,
      }));
    } else {
      if (!allSkuData?.skus) return [];
      return allSkuData.skus.map((item) => ({
        value: item.sku,
        label: item.sku_name || item.sku,
        completedQuantity: 0,
        totalQuantity: 0,
      }));
    }
  }, [selectedOrderId, orderSkuData, allSkuData]);

  const handleOrderSelect = (orderId: string | null) => {
    if (!orderId) {
      clearOrderSelection();
    } else {
      const order = ordersData?.find(o => o.id === orderId);
      if (order) {
        setSelectedOrderId(orderId);
        setSelectedOrderNumber(order.order_number);
      }
    }
    setOrderSelectorOpen(false);
  };

  return (
    <div className="border-b border-sidebar-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-sidebar-border/50">
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground">
          Current Context
        </h3>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Order Selector */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Order
          </div>
          <Popover open={orderSelectorOpen} onOpenChange={setOrderSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={orderSelectorOpen}
                className="w-full justify-between text-left h-auto py-2"
                disabled={isLoadingOrders}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {selectedOrderId ? (
                    <>
                      <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">
                          {selectedOrderNumber || "Order"}
                        </div>
                        {availableOrders.find(o => o.value === selectedOrderId)?.customerName && (
                          <div className="text-xs text-muted-foreground truncate">
                            {availableOrders.find(o => o.value === selectedOrderId)?.customerName}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {availableOrders.find(o => o.value === selectedOrderId)?.totalQuantity || 0} items
                        </Badge>
                        {availableOrders.find(o => o.value === selectedOrderId)?.skuCount ? (
                          <Badge variant="outline" className="text-xs">
                            {availableOrders.find(o => o.value === selectedOrderId)?.skuCount} SKUs
                          </Badge>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Select Order</div>
                        <div className="text-xs text-muted-foreground">
                          Choose an order to view
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search orders..." />
                <CommandList>
                  <CommandEmpty>No orders found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => handleOrderSelect(null)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedOrderId === null ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <FileText className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">None</div>
                        <div className="text-xs text-muted-foreground">
                          No order selected
                        </div>
                      </div>
                    </CommandItem>
                    {availableOrders.map((order) => (
                      <CommandItem
                        key={order.value}
                        value={`${order.label} ${order.customerName || ""}`}
                        onSelect={() => handleOrderSelect(order.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedOrderId === order.value
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <FileText className="mr-2 h-4 w-4" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {order.label}
                          </div>
                          {order.customerName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {order.customerName}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {order.totalQuantity} items
                            </span>
                            {order.skuCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                • {order.skuCount} SKUs
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* SKU Selector */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            SKU
          </div>
          <Popover open={skuSelectorOpen} onOpenChange={setSKUSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={skuSelectorOpen}
                className="w-full justify-between text-left h-auto py-2"
                disabled={isLoadingSKUs}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {selectedSKU ? (
                    <>
                      <Package className="h-4 w-4 flex-shrink-0 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">
                          {availableSKUs.find(
                            (sku) => sku.value === selectedSKU
                          )?.label || selectedSKU}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedOrderId ? "SKU in Order" : "SKU Workflow"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Select SKU</div>
                        <div className="text-xs text-muted-foreground">
                          {selectedOrderId ? "Select SKU from order" : "Choose SKU workflow"}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search SKUs..." />
                <CommandList>
                  <CommandEmpty>No SKUs found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        setSelectedSKU(null);
                        setSKUSelectorOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSKU === null ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">None</div>
                        <div className="text-xs text-muted-foreground">
                          No SKU selected
                        </div>
                      </div>
                    </CommandItem>
                    {availableSKUs.map((sku) => (
                      <CommandItem
                        key={sku.value}
                        value={sku.value}
                        onSelect={(currentValue) => {
                          setSelectedSKU(
                            currentValue === selectedSKU ? null : currentValue
                          );
                          setSKUSelectorOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSKU === sku.value
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <Package className="mr-2 h-4 w-4" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {sku.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {sku.value}
                          </div>
                          {selectedOrderId && sku.completedQuantity !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {sku.completedQuantity}/{sku.totalQuantity} completed
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Context Summary - Only show when both order and SKU are selected */}
        {selectedOrderId && selectedSKU && (
          <div className="pt-2 border-t border-sidebar-border/50 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Summary
            </div>
            
            <div className="space-y-2">
              {/* Total Quantity */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Quantity</span>
                </div>
                {isLoadingCost ? (
                  <Skeleton className="h-5 w-12 rounded-full" />
                ) : (
                  <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {costData?.totalQuantity?.toLocaleString() || 0}
                  </Badge>
                )}
              </div>

              {/* Estimated Cost */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSignIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Estimated Cost</span>
                </div>
                {isLoadingCost ? (
                  <Skeleton className="h-5 w-16 rounded-full" />
                ) : costData?.leafStagesWithPricing === 0 ? (
                  <span className="text-xs text-muted-foreground">No pricing set</span>
                ) : (
                  <Badge 
                    variant="outline" 
                    className={`${costData?.hasMultipleCurrencies 
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200"
                    }`}
                  >
                    {costData?.hasMultipleCurrencies
                      ? "Mixed currencies"
                      : `${getCurrencySymbol(costData?.currency || 'INR')}${costData?.totalCost?.toLocaleString() || 0}`
                    }
                  </Badge>
                )}
              </div>

              {/* Completed Items */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Completed</span>
                </div>
                {availableSKUs.find(s => s.value === selectedSKU)?.completedQuantity !== undefined ? (
                  <Badge variant="outline" className="bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {availableSKUs.find(s => s.value === selectedSKU)?.completedQuantity || 0}
                  </Badge>
                ) : (
                  <Skeleton className="h-5 w-12 rounded-full" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}