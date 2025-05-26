"use client";

import { TrendingDownIcon, TrendingUpIcon, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/queries/use-dashboard-stats";

export function SectionCards() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (error) {
    return (
      <div className="px-4 lg:px-6">
        <div className="text-center text-red-500">
          Failed to load dashboard statistics
        </div>
      </div>
    );
  }

  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6 lg:grid-cols-2 xl:grid-cols-4">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Active Orders</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              stats?.activeOrders?.toLocaleString() || "0"
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
            Orders that have at least one item not yet completed.
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Active Items</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              stats?.activeItems?.toLocaleString() || "0"
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
            Item quantities currently being processed in workflow.
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Items in Rework</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              stats?.itemsInRework?.toLocaleString() || "0"
            )}
          </CardTitle>
          {!isLoading && stats && stats.itemsInRework > 0 && (
            <div className="absolute right-4 top-4">
              <Badge
                variant="destructive"
                className="flex gap-1 rounded-lg text-xs"
              >
                <TrendingUpIcon className="size-3" />
                Attention
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
            Items with recent rework movements.
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Items Waiting &gt; 7 Days</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              stats?.itemsWaitingOver7Days?.toLocaleString() || "0"
            )}
          </CardTitle>
          {!isLoading && stats && stats.itemsWaitingOver7Days > 0 && (
            <div className="absolute right-4 top-4">
              <Badge
                variant="outline"
                className="flex gap-1 rounded-lg text-xs border-orange-500 text-orange-600"
              >
                <TrendingDownIcon className="size-3" />
                Delayed
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
            Items in their current stage for more than 7 days.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
