"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import type { CompositeItemStatus } from "@/types/composite-items";

interface CompositeItemProgressProps {
  compositeStatus: CompositeItemStatus;
  onViewOrder?: (orderSlug: string) => void;
  className?: string;
}

export function CompositeItemProgress({
  compositeStatus,
  onViewOrder,
  className = "",
}: CompositeItemProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-500";
      case "In Progress":
        return "bg-blue-500";
      case "Not Started":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "In Progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "Not Started":
        return <Package className="h-4 w-4 text-gray-400" />;
      default:
        return <Package className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(compositeStatus.composite_status)}
            <div>
              <CardTitle className="text-lg">
                {compositeStatus.parent_composite_sku}
              </CardTitle>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Order #{compositeStatus.order_number}</span>
                {compositeStatus.customer_name && (
                  <>
                    <span>•</span>
                    <span>{compositeStatus.customer_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Badge
            variant={
              compositeStatus.composite_status === "Completed"
                ? "default"
                : "secondary"
            }
            className={`${getStatusColor(compositeStatus.composite_status)} text-white`}
          >
            {compositeStatus.composite_status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-gray-500">
              {compositeStatus.completed_components} of{" "}
              {compositeStatus.total_components} components
            </span>
          </div>
          <Progress
            value={compositeStatus.completion_percentage}
            className="h-2"
          />
          <div className="text-center text-sm font-medium text-gray-700">
            {compositeStatus.completion_percentage}% Complete
          </div>
        </div>

        {/* Component Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-lg text-blue-600">
              {compositeStatus.unique_component_types}
            </div>
            <div className="text-gray-500">Component Types</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-purple-600">
              {compositeStatus.total_component_quantity}
            </div>
            <div className="text-gray-500">Total Quantity</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-green-600">
              {compositeStatus.completed_component_quantity}
            </div>
            <div className="text-gray-500">Completed Qty</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-orange-600">
              {compositeStatus.total_component_quantity -
                compositeStatus.completed_component_quantity}
            </div>
            <div className="text-gray-500">Remaining Qty</div>
          </div>
        </div>

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-center p-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              {isExpanded ? "Hide Details" : "Show Details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div className="border-t pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <div className="text-gray-600">
                    {formatDate(compositeStatus.created_at)}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Last Updated:
                  </span>
                  <div className="text-gray-600">
                    {formatDate(compositeStatus.last_updated)}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Composite Group ID:
                  </span>
                  <div className="text-gray-600 font-mono text-xs break-all">
                    {compositeStatus.composite_group_id}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Order ID:</span>
                  <div className="text-gray-600 font-mono text-xs break-all">
                    {compositeStatus.order_id}
                  </div>
                </div>
              </div>

              {onViewOrder && (
                <div className="pt-3 border-t mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewOrder(compositeStatus.order_number)}
                    className="w-full"
                  >
                    View Order Details
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

interface CompositeItemProgressListProps {
  compositeStatuses: CompositeItemStatus[];
  onViewOrder?: (orderSlug: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function CompositeItemProgressList({
  compositeStatuses,
  onViewOrder,
  isLoading = false,
  className = "",
}: CompositeItemProgressListProps) {
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-24 mx-auto"></div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="text-center space-y-1">
                      <div className="h-6 bg-gray-200 rounded w-8 mx-auto"></div>
                      <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (compositeStatuses.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No composite items in progress
            </h3>
            <p className="text-gray-600">
              Composite items will appear here once they're added to orders.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {compositeStatuses.map((status) => (
        <CompositeItemProgress
          key={status.composite_group_id}
          compositeStatus={status}
          onViewOrder={onViewOrder}
        />
      ))}
    </div>
  );
}
