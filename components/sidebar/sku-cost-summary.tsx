"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PackageIcon, DollarSignIcon } from "lucide-react";
import { SidebarSkuCost } from "@/hooks/queries/use-sidebar-sku-cost";

interface SkuCostSummaryProps {
  costData: SidebarSkuCost | undefined;
  isLoading: boolean;
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

export function SkuCostSummary({ costData, isLoading }: SkuCostSummaryProps) {
  if (isLoading) {
    return (
      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Workflow Cost</span>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    );
  }

  if (!costData || costData.totalQuantity === 0) {
    return null;
  }

  // Don't show if no pricing configured
  if (costData.leafStagesWithPricing === 0) {
    return (
      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Workflow Cost</span>
          <span className="text-xs text-muted-foreground">No pricing set</span>
        </div>
      </div>
    );
  }

  const costDisplay = costData.hasMultipleCurrencies
    ? "Mixed currencies"
    : `${getCurrencySymbol(costData.currency)}${costData.totalCost.toLocaleString()}`;

  return (
    <div className="px-3 py-2 border-b border-sidebar-border">
      <div className="space-y-1">
        {/* Total Quantity */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Quantity</span>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <PackageIcon className="h-3 w-3 mr-1" />
            {costData.totalQuantity.toLocaleString()}
          </Badge>
        </div>

        {/* Estimated Cost */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estimated Cost</span>
          <Badge 
            variant="outline" 
            className={`${costData.hasMultipleCurrencies 
              ? "bg-amber-50 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              : "bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200"
            }`}
          >
            <DollarSignIcon className="h-3 w-3 mr-1" />
            {costDisplay}
          </Badge>
        </div>
      </div>
    </div>
  );
}