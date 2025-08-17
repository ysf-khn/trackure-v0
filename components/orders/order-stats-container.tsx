"use client";

import { OrderStats } from "@/components/orders/order-stats";
import { useOrderItems } from "@/hooks/queries/use-order-items";
import { useOrderCompositeItems } from "@/hooks/queries/use-composite-items";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderStatsContainerProps {
  orderId: string;
  organizationId: string | null;
}

export function OrderStatsContainer({ orderId, organizationId }: OrderStatsContainerProps) {
  const {
    data: regularItems,
    isLoading: regularLoading,
    error: regularError,
  } = useOrderItems(organizationId, orderId);

  const {
    data: compositeData,
    isLoading: compositeLoading,
    error: compositeError,
  } = useOrderCompositeItems(organizationId, orderId);

  const compositeItems = compositeData?.composite_statuses || [];
  const isLoading = regularLoading || compositeLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="p-4">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-3 border rounded-lg">
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate stats from the data
  // IMPORTANT: Filter out replacement items from stats to avoid double-counting
  const regularItemsArray = (regularItems || []).filter(item => !item.is_replacement);
  const compositeItemsArray = compositeItems || [];

  // Calculate regular items stats (excluding replacement items)
  const regularTotal = regularItemsArray.length;
  const regularCompleted = regularItemsArray.filter(item => item.status === "Completed").length;
  const regularInProgress = regularItemsArray.filter(item => item.status === "In Workflow").length;
  const regularNew = regularItemsArray.filter(item => item.status === "New").length;

  // Calculate composite items stats (based on completion percentage)
  const compositeTotal = compositeItemsArray.length;
  const compositeCompleted = compositeItemsArray.filter(item => item.composite_status === "Completed").length;
  const compositeInProgress = compositeItemsArray.filter(item => item.composite_status === "In Progress").length;
  const compositeNew = compositeItemsArray.filter(item => item.composite_status === "Not Started").length;

  // Combined stats
  const totalItems = regularTotal + compositeTotal;
  const completedItems = regularCompleted + compositeCompleted;
  const inProgressItems = regularInProgress + compositeInProgress;
  const newItems = regularNew + compositeNew;

  // Calculate rework items (items that have been moved backward)
  const reworkItems = regularItemsArray.filter(item => {
    // This is a simplified check - in a real implementation, 
    // you'd check the item_movement_history table for rework movements
    return item.stage_allocations?.some(allocation => 
      allocation.stage_name.toLowerCase().includes('rework')
    );
  }).length;

  const stats = {
    totalItems,
    completedItems,
    inProgressItems,
    newItems,
    reworkItems: reworkItems > 0 ? reworkItems : undefined,
  };

  // Show error state if both queries failed
  if (regularError && compositeError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">
          Failed to load order statistics. Please refresh the page.
        </p>
      </div>
    );
  }

  return <OrderStats stats={stats} />;
}