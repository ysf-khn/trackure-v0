"use client";

import * as React from "react";
import { useState } from "react";
import {
  Package,
  ChevronsUpDown,
  Check,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOrders } from "@/hooks/queries/use-orders";
import { useOrderSelection } from "@/contexts/order-selection-context";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

export function OrderSelector() {
  const { organizationId } = useProfileAndOrg();
  const {
    selectedOrderId,
    setSelectedOrderId,
    selectedOrderNumber,
    setSelectedOrderNumber,
    clearOrderSelection,
  } = useOrderSelection();
  
  const [orderSelectorOpen, setOrderSelectorOpen] = useState(false);
  
  // Get available orders
  const { data: ordersData, isLoading: isLoadingOrders } = useOrders(organizationId);

  // Available orders for the selector
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
    <div className="px-3">
      <h3 className="mb-2 text-sm font-semibold tracking-wider text-muted-foreground">
        Current Order
      </h3>
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
                  <FileText className="h-4 w-4 flex-shrink-0" />
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
  );
}