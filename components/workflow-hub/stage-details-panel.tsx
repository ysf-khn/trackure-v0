"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, DollarSign, MapPin, Package, Clock } from "lucide-react";
import { useStageVendorPricing } from "@/hooks/queries/use-stage-vendor-pricing";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

interface StageDetailsPanelProps {
  currentStage: FetchedWorkflowStage | null;
  organizationId: string | null;
  selectedSKU: string | null;
  isLoading?: boolean;
}

export function StageDetailsPanel({
  currentStage,
  organizationId,
  selectedSKU,
  isLoading = false,
}: StageDetailsPanelProps) {
  // Fetch vendor pricing for the current stage and SKU
  const { data: vendorPricing, isLoading: isLoadingPricing } = useStageVendorPricing(
    organizationId,
    currentStage?.id || null,
    selectedSKU
  );

  if (isLoading || !currentStage) {
    return (
      <div className="flex items-center gap-6 py-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
    );
  }

  const primaryVendor = vendorPricing?.find(vp => vp.is_primary) || vendorPricing?.[0];

  return (
    <div className="space-y-3">
      {/* Stage Info Line */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Current Stage:</span>
          <span className="text-sm">{currentStage.name}</span>
          {currentStage.is_leaf_stage && (
            <Badge variant="outline" className="text-xs">
              Leaf
            </Badge>
          )}
        </div>

        {currentStage.location && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{currentStage.location}</span>
          </div>
        )}

        {currentStage.sku && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Package className="h-3 w-3" />
            <span>{currentStage.sku}</span>
          </div>
        )}
      </div>

      {/* Vendor and Cost Line */}
      <div className="flex items-center gap-6 flex-wrap">
        {isLoadingPricing ? (
          <>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </>
        ) : primaryVendor ? (
          <>
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">{primaryVendor.vendor_name}</span>
                {primaryVendor.firm_name && (
                  <span className="text-muted-foreground"> • {primaryVendor.firm_name}</span>
                )}
              </span>
            </div>

            {primaryVendor.price && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {primaryVendor.currency} {primaryVendor.price.toFixed(2)}
                </span>
              </div>
            )}

            {primaryVendor.lead_time_days && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{primaryVendor.lead_time_days} days</span>
              </div>
            )}

            {vendorPricing && vendorPricing.length > 1 && (
              <Badge variant="secondary" className="text-xs">
                +{vendorPricing.length - 1} vendors
              </Badge>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">No vendor assigned</span>
        )}
      </div>
    </div>
  );
}