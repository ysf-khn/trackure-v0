"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSignIcon, 
  PackageIcon, 
  BuildingIcon,
  TrendingUpIcon,
  InfoIcon
} from "lucide-react";
import { WorkflowCostSummary } from "@/hooks/queries/use-workflow-cost-summary";

interface WorkflowCostSummaryCardProps {
  costSummary: WorkflowCostSummary | undefined;
  isLoading: boolean;
}

export function WorkflowCostSummaryCard({ 
  costSummary, 
  isLoading 
}: WorkflowCostSummaryCardProps) {
  
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if costSummary is null/undefined
  if (!costSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <InfoIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Cost data not available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show helpful message if no data
  if (costSummary.totalQuantity === 0 || costSummary.totalStagesWithPricing === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 space-y-2">
            <InfoIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {costSummary.totalStagesWithPricing === 0 && (
              <p className="text-muted-foreground">Configure vendor pricing in Settings</p>
            )}
            {costSummary.totalQuantity === 0 && costSummary.totalStagesWithPricing > 0 && (
              <p className="text-muted-foreground">No items in workflow stages</p>
            )}
            {costSummary.totalQuantity === 0 && costSummary.totalStagesWithPricing === 0 && (
              <p className="text-muted-foreground">Set up vendors and add items to see costs</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSignIcon className="h-5 w-5" />
          Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Cost */}
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-primary">
              {costSummary.hasMultipleCurrencies ? (
                "Mixed"
              ) : (
                `${getCurrencySymbol(costSummary.currency)}${costSummary.estimatedTotalCost.toLocaleString()}`
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {!costSummary.hasMultipleCurrencies && "estimated total"}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <PackageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold">{costSummary.totalQuantity}</div>
              <div className="text-xs text-muted-foreground">items</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <BuildingIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold">{costSummary.totalVendors}</div>
              <div className="text-xs text-muted-foreground">vendors</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold">{costSummary.totalStagesWithPricing}</div>
              <div className="text-xs text-muted-foreground">stages</div>
            </div>
          </div>

          {/* Top Stages by Cost */}
          {costSummary.stageBreakdown.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Top Cost Centers</div>
              <div className="space-y-2">
                {costSummary.stageBreakdown.slice(0, 3).map((stage) => (
                  <div key={stage.stageId} className="flex justify-between items-center">
                    <span className="text-sm truncate flex-1 mr-2">
                      {stage.stageName.length > 20 
                        ? `${stage.stageName.slice(0, 20)}...` 
                        : stage.stageName
                      }
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {getCurrencySymbol(stage.currency)}{stage.estimatedTotalCost.toLocaleString()}
                      </span>
                      {stage.vendorCount > 1 && (
                        <Badge variant="outline" className="text-xs px-2 py-0">
                          {stage.vendorCount}v
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {costSummary.hasMultipleCurrencies && (
            <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
              <InfoIcon className="h-3 w-3 flex-shrink-0" />
              <span>Multiple currencies in use</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}