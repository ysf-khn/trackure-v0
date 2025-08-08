"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin,
  Terminal,
  Package,
  FileText,
  Building2,
  DollarSign,
  Clock,
} from "lucide-react";

import { ItemListTable } from "@/components/items/item-list-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useStage } from "@/hooks/queries/use-stage";
import { useSingleStageItemCounts } from "@/hooks/queries/use-single-stage-item-counts";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import { useStageItemCounts } from "@/hooks/queries/use-stage-item-counts";
import { useStageVendorPricing } from "@/hooks/queries/use-stage-vendor-pricing";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import { useOrderSelection } from "@/contexts/order-selection-context";
import { WorkflowReactFlowCompact } from "@/components/workflow/WorkflowReactFlowCompact";
import { Suspense } from "react";

// Define types for stage data with tree structure
interface StageData {
  id: string;
  name: string | null;
  sequence_order: number;
  location: string | null;
  parent_stage_id: string | null;
  depth_level: number;
  full_path: string | null;
  is_leaf_stage: boolean;
  sku: string | null;
}

// Component for stage view content
function StageViewContent() {
  const params = useParams();
  const router = useRouter();

  // --- Authentication ---
  const {
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();

  // --- Stage ID ---
  const stageId = params.stageId as string | undefined;

  // --- Global selections ---
  const { selectedSKU } = useSKUSelection();
  const { selectedOrderNumber } = useOrderSelection();

  // --- Fetch Stage Data ---
  const {
    data: stageData,
    isLoading: isStageLoading,
    isError: isStageError,
    error: stageError,
  } = useStage(stageId, organizationId);

  // --- Fetch Stage Item Counts ---
  const { data: stageItemCounts, isLoading: isLoadingItemCounts } =
    useSingleStageItemCounts(organizationId, stageId, stageData?.sku);

  // Get workflow structure - use stage SKU or global selected SKU
  const workflowSKU = stageData?.sku || selectedSKU;
  const { data: workflowData, isLoading: isLoadingWorkflow } =
    useWorkflowStructure(organizationId, workflowSKU);

  // Get stage item counts for the workflow
  const { data: stageCountsData, isLoading: isLoadingStageCounts } =
    useStageItemCounts(organizationId, workflowSKU, workflowData);

  // Get vendor pricing for current stage
  const { data: vendorPricingData, isLoading: isLoadingPricing } =
    useStageVendorPricing(stageId);

  const vendorPricing = vendorPricingData?.vendorPricing || [];
  const primaryVendor =
    vendorPricing.find((vp) => vp.vendor?.is_active) || vendorPricing[0];

  // Handle stage navigation from tree
  const handleStageClick = React.useCallback(
    (clickedStageId: string) => {
      router.push(`/workflow/${clickedStageId}`);
    },
    [router]
  );

  // --- Loading and Error States ---
  if (isAuthLoading || isStageLoading) {
    return (
      <div className="h-full flex flex-col px-6 py-4 space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  // Authentication Error
  if (authError) {
    return (
      <Alert variant="destructive" className="m-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Authentication Error</AlertTitle>
        <AlertDescription>
          Could not load user data. Please try refreshing. ({authError})
        </AlertDescription>
      </Alert>
    );
  }

  // Missing Org ID
  if (!organizationId) {
    return (
      <Alert className="m-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Missing Information</AlertTitle>
        <AlertDescription>
          Organization context is missing. Cannot load items.
        </AlertDescription>
      </Alert>
    );
  }

  // Missing Stage ID
  if (!stageId) {
    return (
      <Alert variant="destructive" className="m-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Stage ID is missing from the URL.</AlertDescription>
      </Alert>
    );
  }

  // Stage Data Fetching Error
  if (isStageError) {
    return (
      <Alert variant="destructive" className="m-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Stage</AlertTitle>
        <AlertDescription>
          Could not load details for this stage. Please try refreshing. (
          {stageError?.message || "Unknown error"})
        </AlertDescription>
      </Alert>
    );
  }

  // Stage not found
  if (!stageData) {
    return (
      <Alert variant="destructive" className="m-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Stage Not Found</AlertTitle>
        <AlertDescription>
          The requested stage could not be found or you do not have access to
          it.
        </AlertDescription>
      </Alert>
    );
  }

  // --- Main Content ---
  return (
    <div className="h-full flex flex-col px-6 py-2 space-y-3">

      {/* Workflow Tree Visualization - Always Visible */}
      {workflowData && workflowData.length > 0 && (
        <>
          <div className="flex-shrink-0">
            <WorkflowReactFlowCompact
              workflowData={workflowData}
              stageCountsData={stageCountsData}
              isLoadingStageCounts={isLoadingStageCounts}
              onStageClick={handleStageClick}
              currentStageId={stageId}
              height="h-96"
            />
          </div>
          <Separator />
        </>
      )}

      {/* Current Stage Details */}
      <div className="space-y-3">
        {/* Stage Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {stageData?.name || "Unnamed Stage"}
            {stageData?.parent_stage_id && stageData?.full_path && (
              <span className="text-muted-foreground text-sm ml-2">
                ({stageData.full_path})
              </span>
            )}
          </h2>
          <Badge variant="outline">
            Sequence Order: {(stageData?.sequence_order ?? 0) + 1}
          </Badge>
        </div>

        {/* Vendor and Cost Info */}
        <div className="flex items-center gap-6 flex-wrap">
          {stageData?.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{stageData.location}</span>
            </div>
          )}

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
                  <span className="font-medium">
                    {primaryVendor.vendor?.name}
                  </span>
                  {primaryVendor.vendor?.firm_name && (
                    <span className="text-muted-foreground">
                      {" "}
                      • {primaryVendor.vendor?.firm_name}
                    </span>
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
            <span className="text-sm text-muted-foreground">
              No vendor assigned
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Items Table */}
      <div className="flex-1 overflow-auto">
        {stageId && organizationId && (
          <ItemListTable stageId={stageId} organizationId={organizationId} />
        )}
      </div>
    </div>
  );
}

// Main component wrapped in Suspense
export default function StageViewPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex flex-col px-6 py-4 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      }
    >
      <StageViewContent />
    </Suspense>
  );
}
