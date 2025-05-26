"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Package,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  ShoppingCart,
  MapPin,
  Hash,
  User,
  Layers,
  CheckCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderItems, OrderItem } from "@/hooks/queries/use-order-items";

interface OrderItemsDisplayProps {
  orderId: string;
  organizationId: string | null;
  userRole?: string | null;
}

const StatusBadgeVariant = (status: string) => {
  switch (status) {
    case "New":
      return "secondary";
    case "In Workflow":
      return "default";
    case "Completed":
      return "outline";
    default:
      return "secondary";
  }
};

const getWorkflowStatusColor = (stageName: string) => {
  const lowerStageName = stageName.toLowerCase();
  if (lowerStageName.includes("completed")) {
    return "bg-green-50 border-green-200";
  } else if (
    lowerStageName.includes("in progress") ||
    lowerStageName.includes("processing")
  ) {
    return "bg-blue-50 border-blue-200";
  } else if (
    lowerStageName.includes("pending") ||
    lowerStageName.includes("waiting")
  ) {
    return "bg-yellow-50 border-yellow-200";
  } else {
    return "bg-accent/5 border-accent/20";
  }
};

const ItemCard = ({
  item,
  userRole,
}: {
  item: OrderItem;
  userRole?: string | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasInstanceDetails =
    item.instance_details && Object.keys(item.instance_details).length > 0;
  const hasStageAllocations =
    item.stage_allocations && item.stage_allocations.length > 0;

  const canDownloadVoucher = userRole === "Owner" || userRole === "Worker";

  // Calculate quantities properly
  const completedQuantity = item.total_quantity - item.remaining_quantity;

  // Calculate quantity in completed stages vs active workflow
  const quantityInCompletedStages = item.stage_allocations
    .filter((allocation) =>
      allocation.stage_name.toLowerCase().includes("completed")
    )
    .reduce((sum, allocation) => sum + allocation.quantity, 0);

  // In Workflow should exclude completed stages
  const quantityInActiveWorkflow = item.stage_allocations
    .filter(
      (allocation) => !allocation.stage_name.toLowerCase().includes("completed")
    )
    .reduce((sum, allocation) => sum + allocation.quantity, 0);

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-l-4 border-l-accent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Package className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {item.sku}
              </CardTitle>
              {item.buyer_id && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <User className="h-3 w-3 mr-1" />
                  Buyer ID: {item.buyer_id}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={StatusBadgeVariant(item.status)}>
              {item.status}
            </Badge>
            {canDownloadVoucher && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hover:bg-accent hover:text-accent-foreground"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download Voucher</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quantity Information */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <ShoppingCart className="h-3 w-3 mr-1" />
              Total Quantity
            </div>
            <div className="text-2xl font-bold text-accent-foreground">
              {item.total_quantity}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </div>
            <div className="text-2xl font-bold text-green-600">
              {completedQuantity}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Layers className="h-3 w-3 mr-1" />
              In Workflow
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {quantityInActiveWorkflow}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Hash className="h-3 w-3 mr-1" />
              New Pool
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {item.quantity_in_new_pool}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              Remaining
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {item.remaining_quantity}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-accent h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(0, Math.min(100, (completedQuantity / item.total_quantity) * 100))}%`,
            }}
          />
        </div>
        <div className="text-sm text-muted-foreground text-center">
          {item.total_quantity > 0
            ? Math.round((completedQuantity / item.total_quantity) * 100)
            : 0}
          % completed
        </div>

        {/* Expandable Details */}
        {(hasInstanceDetails || hasStageAllocations) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between hover:bg-accent/10"
              >
                <span className="flex items-center">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              {/* Instance Details */}
              {hasInstanceDetails && (
                <div className="bg-accent/5 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-accent-foreground">
                    Item Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(item.instance_details).map(
                      ([key, value]) => (
                        <div key={key} className="flex flex-col space-y-1">
                          <span className="text-muted-foreground text-xs uppercase tracking-wide">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium text-foreground">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Stage Allocations */}
              {hasStageAllocations && (
                <div className="bg-accent/5 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-accent-foreground">
                    Workflow Status
                  </h4>
                  <div className="space-y-3">
                    {item.stage_allocations.map((allocation, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between rounded-lg p-3 border ${getWorkflowStatusColor(allocation.stage_name)}`}
                      >
                        <div className="flex items-center space-x-3">
                          <MapPin className="h-4 w-4 text-accent" />
                          <div className="flex flex-col">
                            <span className="font-medium text-black">
                              {allocation.stage_name}
                            </span>
                            {allocation.sub_stage_name && (
                              <span className="text-xs text-muted-foreground">
                                {allocation.sub_stage_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {allocation.quantity} units
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Timestamps */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>
            Created{" "}
            {formatDistanceToNow(new Date(item.created_at), {
              addSuffix: true,
            })}
          </span>
          <span>
            Updated{" "}
            {formatDistanceToNow(new Date(item.updated_at), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-2 w-full mb-2" />
      <Skeleton className="h-4 w-24 mx-auto" />
    </CardContent>
  </Card>
);

export default function OrderItemsDisplay({
  orderId,
  organizationId,
  userRole,
}: OrderItemsDisplayProps) {
  const {
    data: items,
    isLoading,
    error,
  } = useOrderItems(organizationId, orderId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-destructive">
            Failed to load items: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center space-y-2">
            <Package className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Items Found</h3>
            <p className="text-muted-foreground">
              This order doesn't have any items yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-accent-foreground">
          Items ({items.length})
        </h3>
        <div className="text-sm text-muted-foreground">
          Total: {items.reduce((sum, item) => sum + item.total_quantity, 0)}{" "}
          units
        </div>
      </div>

      {items.map((item) => (
        <ItemCard key={item.id} item={item} userRole={userRole} />
      ))}
    </div>
  );
}
