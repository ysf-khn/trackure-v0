"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PackageIcon, 
  LayoutListIcon,
  AlertTriangleIcon,
  InfoIcon
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface WorkflowItemsSummaryData {
  totalItems: number;
  totalQuantity: number;
  normalQuantity: number;
  reworkedQuantity: number;
  stagesWithItems: number;
  totalStages: number;
}

interface WorkflowItemsSummaryProps {
  itemsSummary: WorkflowItemsSummaryData;
  isLoading: boolean;
}

export function WorkflowItemsSummaryComponent({ 
  itemsSummary, 
  isLoading 
}: WorkflowItemsSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (isLoading) {
    return (
      <div className="px-3 py-2 space-y-2">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // Show helpful message if no items
  if (itemsSummary.totalQuantity === 0) {
    return (
      <div className="px-3 py-2 space-y-2">
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground">
          Items Summary
        </h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <InfoIcon className="h-3 w-3 flex-shrink-0" />
            <span>No items in workflow stages</span>
          </div>
        </div>
      </div>
    );
  }

  const hasReworkedItems = itemsSummary.reworkedQuantity > 0;

  return (
    <div className="px-3 py-2 space-y-2">
      <h3 className="text-sm font-semibold tracking-wider text-muted-foreground">
        Items Summary
      </h3>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 py-1 h-auto text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <PackageIcon className="h-3 w-3 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {itemsSummary.totalQuantity} items
                </span>
                {hasReworkedItems && (
                  <AlertTriangleIcon className="h-3 w-3 text-orange-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <LayoutListIcon className="h-3 w-3 flex-shrink-0" />
                <span>
                  {itemsSummary.stagesWithItems} of {itemsSummary.totalStages} stages active
                </span>
              </div>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-2 pt-2">
          {/* Quantity Breakdown */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-1">
              Quantity Breakdown:
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span>Normal</span>
              </span>
              <Badge variant="default" className="bg-primary text-white text-xs px-1.5 py-0.5">
                {itemsSummary.normalQuantity}
              </Badge>
            </div>
            {hasReworkedItems && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                  <span>Reworked</span>
                </span>
                <Badge variant="destructive" className="bg-orange-500 text-white text-xs px-1.5 py-0.5">
                  {itemsSummary.reworkedQuantity}
                </Badge>
              </div>
            )}
          </div>

          {/* Stage Utilization */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-1">
              Stage Utilization:
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Active Stages</span>
              <span className="text-primary font-medium">
                {itemsSummary.stagesWithItems}/{itemsSummary.totalStages}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                style={{ 
                  width: `${Math.round((itemsSummary.stagesWithItems / itemsSummary.totalStages) * 100)}%` 
                }}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}