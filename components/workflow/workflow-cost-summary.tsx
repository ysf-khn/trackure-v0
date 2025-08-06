"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSignIcon, 
  PackageIcon, 
  BuildingIcon,
  TrendingUpIcon,
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
import { WorkflowCostSummary } from "@/hooks/queries/use-workflow-cost-summary";

interface WorkflowCostSummaryProps {
  costSummary: WorkflowCostSummary;
  isLoading: boolean;
}

export function WorkflowCostSummaryComponent({ 
  costSummary, 
  isLoading 
}: WorkflowCostSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Don't render if costSummary is null/undefined
  if (!costSummary) {
    return null;
  }

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'INR': return '₹';
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'Mixed': return '';
      default: return currency;
    }
  };

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

  // Show helpful message if no data
  if (costSummary.totalQuantity === 0 || costSummary.totalStagesWithPricing === 0) {
    return (
      <div className="px-3 py-2 space-y-2">
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground">
          Cost Summary
        </h3>
        <div className="text-xs text-muted-foreground space-y-1">
          {costSummary.totalStagesWithPricing === 0 && (
            <div className="flex items-center gap-1">
              <InfoIcon className="h-3 w-3 flex-shrink-0" />
              <span>Configure vendor pricing in Settings</span>
            </div>
          )}
          {costSummary.totalQuantity === 0 && costSummary.totalStagesWithPricing > 0 && (
            <div className="flex items-center gap-1">
              <InfoIcon className="h-3 w-3 flex-shrink-0" />
              <span>No items in workflow stages</span>
            </div>
          )}
          {costSummary.totalQuantity === 0 && costSummary.totalStagesWithPricing === 0 && (
            <div className="flex items-center gap-1">
              <InfoIcon className="h-3 w-3 flex-shrink-0" />
              <span>Set up vendors and add items to see costs</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2">
      <h3 className="text-sm font-semibold tracking-wider text-muted-foreground">
        Cost Summary
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
                <span className="text-sm font-medium truncate">
                  {costSummary.totalQuantity} items
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                <DollarSignIcon className="h-3 w-3 flex-shrink-0" />
                <span className="font-medium">
                  {costSummary.hasMultipleCurrencies ? (
                    "Mixed currencies"
                  ) : (
                    `${getCurrencySymbol(costSummary.currency)}${costSummary.estimatedTotalCost.toLocaleString()}`
                  )}
                </span>
                {!costSummary.hasMultipleCurrencies && (
                  <span className="text-muted-foreground">est.</span>
                )}
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
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <BuildingIcon className="h-3 w-3 text-muted-foreground" />
              <span>{costSummary.totalVendors} vendors</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUpIcon className="h-3 w-3 text-muted-foreground" />
              <span>{costSummary.totalStagesWithPricing} stages</span>
            </div>
          </div>

          {/* Top 3 Stages by Cost */}
          {costSummary.stageBreakdown.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground mb-1">
                Top Costs:
              </div>
              {costSummary.stageBreakdown.slice(0, 3).map((stage) => (
                <div key={stage.stageId} className="flex justify-between items-center text-xs">
                  <span className="truncate flex-1 mr-2">
                    {stage.stageName.length > 12 
                      ? `${stage.stageName.slice(0, 12)}...` 
                      : stage.stageName
                    }
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-primary font-medium">
                      {getCurrencySymbol(stage.currency)}{stage.estimatedTotalCost.toLocaleString()}
                    </span>
                    {stage.vendorCount > 1 && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {stage.vendorCount}v
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {costSummary.hasMultipleCurrencies && (
            <div className="flex items-center gap-1 text-xs text-amber-600 mt-2">
              <InfoIcon className="h-3 w-3 flex-shrink-0" />
              <span>Multiple currencies in use</span>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}