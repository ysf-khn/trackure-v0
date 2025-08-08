"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PackageIcon, 
  LayoutListIcon,
  AlertTriangleIcon,
  InfoIcon
} from "lucide-react";

interface WorkflowItemsSummaryData {
  totalItems: number;
  totalQuantity: number;
  normalQuantity: number;
  reworkedQuantity: number;
  stagesWithItems: number;
  totalStages: number;
}

interface WorkflowItemsSummaryCardProps {
  itemsSummary: WorkflowItemsSummaryData;
  isLoading: boolean;
}

export function WorkflowItemsSummaryCard({ 
  itemsSummary, 
  isLoading 
}: WorkflowItemsSummaryCardProps) {
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Items Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasReworkedItems = itemsSummary.reworkedQuantity > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageIcon className="h-5 w-5" />
          Items Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {itemsSummary.totalQuantity === 0 ? (
          <div className="text-center py-6">
            <InfoIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No items in workflow stages</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total Items */}
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {itemsSummary.totalQuantity}
              </div>
              <div className="text-sm text-muted-foreground">total items</div>
              {hasReworkedItems && (
                <AlertTriangleIcon className="h-4 w-4 text-orange-500 ml-auto" />
              )}
            </div>

            {/* Quantity Breakdown */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Quantity Breakdown</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">Normal</span>
                  <Badge variant="default" className="bg-primary text-white">
                    {itemsSummary.normalQuantity}
                  </Badge>
                </div>
                {hasReworkedItems && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-sm">Reworked</span>
                    <Badge variant="destructive" className="bg-orange-500 text-white">
                      {itemsSummary.reworkedQuantity}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Stage Utilization */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <LayoutListIcon className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Stage Utilization</div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active Stages</span>
                <span className="font-medium">
                  {itemsSummary.stagesWithItems} of {itemsSummary.totalStages}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${Math.round((itemsSummary.stagesWithItems / itemsSummary.totalStages) * 100)}%` 
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {Math.round((itemsSummary.stagesWithItems / itemsSummary.totalStages) * 100)}% utilization
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}