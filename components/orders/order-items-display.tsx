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
  ExternalLink,
  PackageCheck,
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrderItems, OrderItem } from "@/hooks/queries/use-order-items";
import { useOrderCompositeItems } from "@/hooks/queries/use-composite-items";
import { useMultiplePermissions } from "@/hooks/queries/use-permission-check";
import type { CompositeItemStatus } from "@/types/composite-items";
import Link from "next/link";

// Helper interface for grouping items
interface ItemGroup {
  type: "single" | "composite";
  composite_group_id?: string;
  parent_composite_sku?: string;
  items: OrderItem[];
}

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

// Helper function to group items by composite groups
const groupItems = (items: OrderItem[]): ItemGroup[] => {
  const groups: { [key: string]: ItemGroup } = {};
  const singleItems: ItemGroup[] = [];

  items.forEach((item) => {
    if (item.composite_group_id && item.parent_composite_sku) {
      // This is a composite component item
      const groupKey = item.composite_group_id;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          type: "composite",
          composite_group_id: item.composite_group_id,
          parent_composite_sku: item.parent_composite_sku,
          items: [],
        };
      }
      groups[groupKey].items.push(item);
    } else {
      // This is a single item
      singleItems.push({
        type: "single",
        items: [item],
      });
    }
  });

  // Return grouped composite items first, then single items
  return [...Object.values(groups), ...singleItems];
};

// Component to display a group of composite sub-items
const CompositeGroupCard = ({
  group,
  userRole,
}: {
  group: ItemGroup;
  userRole?: string | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (group.type !== "composite") return null;

  const totalQuantity = group.items.reduce(
    (sum, item) => sum + item.total_quantity,
    0
  );
  const completedQuantity = group.items.reduce(
    (sum, item) => sum + (item.total_quantity - item.remaining_quantity),
    0
  );
  const progressPercentage =
    totalQuantity > 0 ? (completedQuantity / totalQuantity) * 100 : 0;

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-l-4 border-l-primary bg-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold text-foreground">
                  {group.parent_composite_sku}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30"
                >
                  Composite Item
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {group.items.length} components • Group ID:{" "}
                {group.composite_group_id?.slice(0, 8)}...
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-primary/10 text-primary">
              {Math.round(progressPercentage)}% Complete
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-accent/50"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress Overview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-primary">
              {totalQuantity}
            </div>
            <div className="text-xs text-muted-foreground">Total Items</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              {completedQuantity}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600">
              {totalQuantity - completedQuantity}
            </div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(0, Math.min(100, progressPercentage))}%`,
            }}
          />
        </div>

        {/* Component Items (when expanded) */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-3 mt-4">
            <div className="border-t pt-3 space-y-3">
              <h4 className="font-medium text-foreground text-sm">
                Component Items:
              </h4>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="ml-4 pl-4 border-l-2 border-primary/30 bg-background rounded-lg p-3 shadow-sm"
                >
                  <ItemCard item={item} userRole={userRole} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

const CompositeItemCard = ({
  compositeStatus,
  userRole,
}: {
  compositeStatus: CompositeItemStatus;
  userRole?: string | null;
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "In Progress":
        return <Clock className="h-5 w-5 text-primary" />;
      case "Not Started":
        return <PackageCheck className="h-5 w-5 text-muted-foreground" />;
      default:
        return <PackageCheck className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              {getStatusIcon(compositeStatus.composite_status)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">
                  {compositeStatus.parent_composite_sku}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30"
                >
                  Composite Item
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {compositeStatus.unique_component_types} component types
              </div>
            </div>
          </div>
          <Badge variant="outline">{compositeStatus.composite_status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quantity Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Layers className="h-3 w-3 mr-1" />
              Total Components
            </div>
            <div className="text-2xl font-bold text-primary">
              {compositeStatus.total_components}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </div>
            <div className="text-2xl font-bold text-green-600">
              {compositeStatus.completed_components}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <ShoppingCart className="h-3 w-3 mr-1" />
              Total Quantity
            </div>
            <div className="text-2xl font-bold text-accent-foreground">
              {compositeStatus.total_component_quantity}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Package className="h-3 w-3 mr-1" />
              Remaining
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {compositeStatus.total_component_quantity -
                compositeStatus.completed_component_quantity}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${compositeStatus.completion_percentage}%` }}
          />
        </div>
        <div className="text-sm text-muted-foreground text-center">
          {compositeStatus.completion_percentage}% completed
        </div>

        {/* Timestamps */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>
            Created{" "}
            {formatDistanceToNow(new Date(compositeStatus.created_at), {
              addSuffix: true,
            })}
          </span>
          <span>
            Updated{" "}
            {formatDistanceToNow(new Date(compositeStatus.last_updated), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const ItemCard = ({
  item,
  userRole,
}: {
  item: OrderItem;
  userRole?: string | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get only the specific permission we need for this component
  const permissions = useMultiplePermissions(["documents.vouchers"]);
  const hasPermission = (permissionKey: string): boolean => {
    return permissions[permissionKey] || false;
  };

  const hasInstanceDetails =
    item.instance_details && Object.keys(item.instance_details).length > 0;
  const hasStageAllocations =
    item.stage_allocations && item.stage_allocations.length > 0;

  const canDownloadVoucher = hasPermission("documents.vouchers");

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
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">
                  {item.sku}
                </CardTitle>
                {item.composite_group_id && item.parent_composite_sku && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/30 text-xs"
                  >
                    Component of {item.parent_composite_sku}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-6 w-6 p-0"
                >
                  <Link href={`/items/${item.id}`}>
                    <ExternalLink className="h-3 w-3" />
                    <span className="sr-only">View item details</span>
                  </Link>
                </Button>
              </div>
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
            <div className="text-2xl font-bold text-primary">
              {quantityInActiveWorkflow}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Hash className="h-3 w-3 mr-1" />
              New Pool
            </div>
            <div className="text-2xl font-bold text-accent-foreground">
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
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
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
    data: rawItems,
    isLoading: itemsLoading,
    error: itemsError,
  } = useOrderItems(organizationId, orderId);

  const {
    data: compositeData,
    isLoading: compositeLoading,
    error: compositeError,
  } = useOrderCompositeItems(organizationId, orderId);

  // Filter out replacement items to avoid double-counting
  const items = rawItems?.filter(item => !item.is_replacement) || [];
  const compositeItems = compositeData?.composite_statuses || [];

  const isLoading = itemsLoading || compositeLoading;
  const hasItems = items && items.length > 0;
  const hasCompositeItems = compositeItems && compositeItems.length > 0;
  const hasAnyItems = hasItems || hasCompositeItems;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (itemsError && compositeError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-destructive">
            Failed to load items: {itemsError.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasAnyItems) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center space-y-2">
            <Package className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Items Found</h3>
            <p className="text-muted-foreground">
              This order doesn't have any items or composite items yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If only one type exists, don't show tabs
  if ((hasItems && !hasCompositeItems) || (!hasItems && hasCompositeItems)) {
    if (hasItems) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-accent/20 rounded-md">
                <Package className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Total Individual Items ({items.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  Regular items in this order
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-accent-foreground">
                {items.reduce((sum, item) => sum + item.total_quantity, 0)}
              </div>
              <div className="text-sm text-muted-foreground">units</div>
            </div>
          </div>

          {groupItems(items).map((group, index) => {
            if (group.type === "composite") {
              return (
                <CompositeGroupCard
                  key={group.composite_group_id || index}
                  group={group}
                  userRole={userRole}
                />
              );
            } else {
              return (
                <ItemCard
                  key={group.items[0].id}
                  item={group.items[0]}
                  userRole={userRole}
                />
              );
            }
          })}
        </div>
      );
    }

    if (hasCompositeItems) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-accent/20 rounded-md">
                <PackageCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Composite Items ({compositeItems.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  Multi-component items and their progress
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-accent-foreground">
                {compositeItems.reduce(
                  (sum, item) => sum + item.total_component_quantity,
                  0
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                component units
              </div>
            </div>
          </div>

          {compositeItems.map((compositeStatus) => (
            <CompositeItemCard
              key={compositeStatus.composite_group_id}
              compositeStatus={compositeStatus}
              userRole={userRole}
            />
          ))}
        </div>
      );
    }
  }

  // Show both in tabs when both exist
  return (
    <div className="space-y-4">
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-border">
          <TabsTrigger
            value="items"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <Package className="h-4 w-4" />
            Total Individual Items ({items?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="composite"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <PackageCheck className="h-4 w-4" />
            Composite ({compositeItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 mt-6">
          {hasItems ? (
            <>
              <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/20 rounded-md">
                    <Package className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Total Individual Items ({items.length})
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Regular items in this order
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-accent-foreground">
                    {items.reduce((sum, item) => sum + item.total_quantity, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">units</div>
                </div>
              </div>

              {groupItems(items).map((group, index) => {
                if (group.type === "composite") {
                  return (
                    <CompositeGroupCard
                      key={group.composite_group_id || index}
                      group={group}
                      userRole={userRole}
                    />
                  );
                } else {
                  return (
                    <ItemCard
                      key={group.items[0].id}
                      item={group.items[0]}
                      userRole={userRole}
                    />
                  );
                }
              })}
            </>
          ) : (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-muted/50 rounded-full">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      No Regular Items
                    </h3>
                    <p className="text-muted-foreground max-w-sm">
                      This order doesn't have any regular items yet. Add items
                      to get started.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="composite" className="space-y-4 mt-6">
          {hasCompositeItems ? (
            <>
              <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/20 rounded-md">
                    <PackageCheck className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Composite Items ({compositeItems.length})
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Multi-component items and their progress
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-accent-foreground">
                    {compositeItems.reduce(
                      (sum, item) => sum + item.total_component_quantity,
                      0
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    component units
                  </div>
                </div>
              </div>

              {compositeItems.map((compositeStatus) => (
                <CompositeItemCard
                  key={compositeStatus.composite_group_id}
                  compositeStatus={compositeStatus}
                  userRole={userRole}
                />
              ))}
            </>
          ) : (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-purple-50 rounded-full">
                    <PackageCheck className="h-12 w-12 text-purple-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      No Composite Items
                    </h3>
                    <p className="text-muted-foreground max-w-sm">
                      This order doesn't have any composite items yet. Create
                      composite items to track multi-component products.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
