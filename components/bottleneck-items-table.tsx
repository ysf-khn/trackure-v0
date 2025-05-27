"use client";

import React from "react";
import { useBottleneckItems } from "@/hooks/queries/use-bottleneck-items";
import { BottleneckItem } from "@/app/api/dashboard/bottleneck-items/route";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, Package } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface BottleneckItemsTableProps {
  limit?: number;
}

export function BottleneckItemsTable({
  limit = 10,
}: BottleneckItemsTableProps) {
  const { data: bottleneckItems, isLoading, error } = useBottleneckItems(limit);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Items Waiting Longest (Potential Bottlenecks)
          </CardTitle>
          <CardDescription>
            Failed to load bottleneck data. Please try again later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-500" />
          Items Waiting Longest (Potential Bottlenecks)
        </CardTitle>
        <CardDescription>
          Top {limit} active items that have spent the longest time in their
          current stage
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : !bottleneckItems || bottleneckItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No items found waiting in stages. Great job keeping things moving!
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item ID/SKU</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Time in Stage</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottleneckItems.map((item) => (
                  <TableRow key={`${item.item_id}-${item.current_stage_name}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">{item.sku}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.order_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.current_stage_name}
                        </span>
                        {item.current_sub_stage_name && (
                          <span className="text-sm text-muted-foreground">
                            {item.current_sub_stage_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getTimeVariant(item.time_in_current_stage)}
                        className="font-mono"
                      >
                        {item.time_in_current_stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to determine badge variant based on time in stage
function getTimeVariant(
  timeInStage: string
): "default" | "secondary" | "destructive" | "outline" {
  if (timeInStage.includes("day")) {
    const days = parseInt(timeInStage.split(" ")[0]);
    if (days >= 7) return "destructive";
    if (days >= 3) return "secondary";
  }
  return "outline";
}
