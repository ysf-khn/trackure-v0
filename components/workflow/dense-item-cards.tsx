"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  Package,
  User,
  MapPin,
  ArrowRight,
  MoreHorizontal,
  History,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ItemInStage } from "@/hooks/queries/use-items-in-stage";
import Link from "next/link";

interface DenseItemCardsProps {
  items: ItemInStage[];
  stageName: string;
  onItemAction?: (itemId: string, action: string) => void;
  showStageContext?: boolean;
  isLoading?: boolean;
}

export function DenseItemCards({
  items,
  stageName,
  onItemAction,
  showStageContext = false,
  isLoading = false,
}: DenseItemCardsProps) {
  const getItemStatusColor = (item: ItemInStage) => {
    if (item.entry_type === "reworked") return "text-orange-600";

    // Check if item has been in stage too long (>7 days)
    if (item.current_stage_entered_at) {
      const enteredAt = new Date(item.current_stage_entered_at);
      const daysDiff =
        (Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) return "text-red-600";
      if (daysDiff > 3) return "text-yellow-600";
    }

    return "text-green-600";
  };

  const getItemStatusIcon = (item: ItemInStage) => {
    if (item.entry_type === "reworked") {
      return <AlertTriangle className="h-4 w-4" />;
    }

    if (item.current_stage_entered_at) {
      const enteredAt = new Date(item.current_stage_entered_at);
      const daysDiff =
        (Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) return <AlertTriangle className="h-4 w-4" />;
      if (daysDiff > 3) return <Clock className="h-4 w-4" />;
    }

    return <CheckCircle className="h-4 w-4" />;
  };

  const calculateProgress = (item: ItemInStage): number => {
    // This would need to be calculated based on workflow position
    // For now, return a placeholder
    return Math.floor(Math.random() * 100);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-8 bg-muted rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No items in {stageName}</h3>
          <p className="text-muted-foreground">
            Items will appear here when they enter this stage
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Items count header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Items in {stageName}</h3>
          <Badge variant="outline">
            {items.length} items •{" "}
            {items.reduce((sum, item) => sum + item.quantity, 0)} total qty
          </Badge>
        </div>
      </div>

      {/* Item cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const statusColor = getItemStatusColor(item);
          const StatusIcon = () => getItemStatusIcon(item);
          const progress = calculateProgress(item);

          return (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">
                      Order #{item.order_number || "N/A"}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {item.sku}
                      </Badge>
                      <Badge
                        variant={
                          item.entry_type === "reworked"
                            ? "destructive"
                            : "default"
                        }
                        className="text-xs"
                      >
                        {item.entry_type === "reworked" ? "Rework" : "Normal"}
                      </Badge>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/items/${item.source_item_id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <History className="mr-2 h-4 w-4" />
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Move Forward
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Send for Rework
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Quantity and status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Qty: {item.quantity}
                    </span>
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          className={cn("flex items-center gap-1", statusColor)}
                        >
                          <StatusIcon />
                          <span className="text-xs">
                            {item.current_stage_entered_at &&
                              formatDistanceToNow(
                                new Date(item.current_stage_entered_at),
                                { addSuffix: true }
                              )}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Time in current stage</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Workflow Progress
                    </span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Instance details preview */}
                {item.instance_details &&
                  Object.keys(item.instance_details).length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Details:
                      </div>
                      <div className="space-y-1">
                        {Object.entries(item.instance_details)
                          .slice(0, 2)
                          .map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between text-xs"
                            >
                              <span className="text-muted-foreground capitalize">
                                {key.replace(/_/g, " ")}:
                              </span>
                              <span className="font-medium truncate ml-2">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                {/* Rework information */}
                {item.entry_type === "reworked" && item.rework_reasons && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded-md">
                    <div className="text-xs text-orange-800">
                      <div className="font-medium mb-1">Rework Reasons:</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {item.rework_reasons.slice(0, 2).map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Composite item indicator */}
                {item.composite_group_id && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      Composite: {item.parent_composite_sku}
                    </Badge>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <ArrowRight className="mr-2 h-3 w-3" />
                    Move
                  </Button>
                  <Button size="sm" variant="outline">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
