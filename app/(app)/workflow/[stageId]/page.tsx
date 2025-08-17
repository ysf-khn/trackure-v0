"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Terminal,
  Package,
  FileText,
  Building2,
  DollarSign,
  Clock,
  AlertCircle,
} from "lucide-react";

import { ItemListTable } from "@/components/items/item-list-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useStage } from "@/hooks/queries/use-stage";
import { useSingleStageItemCounts } from "@/hooks/queries/use-single-stage-item-counts";
import { useStageVendorPricing } from "@/hooks/queries/use-stage-vendor-pricing";
import { useOrderSelection } from "@/contexts/order-selection-context";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AssignVendorModal } from "@/components/workflow/assign-vendor-modal";

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
  const { selectedOrderNumber, selectedOrderId } = useOrderSelection();
  const { selectedSKU } = useSKUSelection();

  // --- Vendor Assignment Modal State ---
  const [isVendorModalOpen, setIsVendorModalOpen] = React.useState(false);

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

  // Get vendor pricing for current stage
  const { data: vendorPricingData, isLoading: isLoadingPricing } =
    useStageVendorPricing(stageId);

  const vendorPricing = vendorPricingData?.vendorPricing || [];
  const primaryVendor =
    vendorPricing.find((vp) => vp.vendor?.is_active) || vendorPricing[0];

  // --- Fetch workflow structure for the selected SKU to find first stage ---
  const { data: workflowData } = useWorkflowStructure(
    organizationId,
    selectedSKU
  );

  // Find first leaf stage for navigation
  const getFirstWorkflowStage = React.useMemo(() => {
    if (!workflowData || workflowData.length === 0) return null;

    const findFirstLeafStage = (stages: typeof workflowData): string | null => {
      for (const stage of stages) {
        if (
          stage.is_leaf_stage ||
          !stage.children ||
          stage.children.length === 0
        ) {
          return stage.id;
        }
        if (stage.children && stage.children.length > 0) {
          const childResult = findFirstLeafStage(stage.children);
          if (childResult) return childResult;
        }
      }
      return null;
    };

    return findFirstLeafStage(workflowData);
  }, [workflowData]);

  // Check for SKU mismatch
  const skuMismatch = React.useMemo(() => {
    if (!stageData || !selectedSKU) return false;
    // Check if the stage's SKU doesn't match the selected SKU
    return stageData.sku && stageData.sku !== selectedSKU;
  }, [stageData, selectedSKU]);

  // --- Loading and Error States ---
  if (isAuthLoading || isStageLoading) {
    return (
      <div className="flex flex-col space-y-4">
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
    <div className="flex flex-col space-y-3">
      {/* SKU Mismatch Warning */}
      {skuMismatch && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle>SKU Mismatch</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              This stage belongs to SKU <strong>{stageData?.sku}</strong> but
              you have selected SKU <strong>{selectedSKU}</strong>.
            </p>
            {getFirstWorkflowStage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/workflow/${getFirstWorkflowStage}`)
                }
                className="mt-2"
              >
                Go to {selectedSKU} workflow
              </Button>
            )}
          </AlertDescription>
        </Alert>
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
          <div className="flex items-center gap-2">
            {stageData?.is_leaf_stage && selectedSKU && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVendorModalOpen(true)}
                disabled={!selectedSKU}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Assign Vendor
              </Button>
            )}
            <Badge variant="outline">
              Sequence Order: {(stageData?.sequence_order ?? 0) + 1}
            </Badge>
          </div>
        </div>

        {/* Location Info */}
        {stageData?.location && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{stageData.location}</span>
          </div>
        )}

        {/* Vendor Details */}
        {isLoadingPricing ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-full max-w-md" />
          </div>
        ) : vendorPricing && vendorPricing.length > 0 ? (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Vendor Name */}
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {vendorPricing[0].vendor?.id ? (
                  <Link 
                    href={`/vendors/${vendorPricing[0].vendor.id}`}
                    className="font-medium hover:underline text-primary"
                  >
                    {vendorPricing[0].vendor?.name || "Unknown Vendor"}
                    {vendorPricing[0].vendor?.firm_name && (
                      <span className="text-muted-foreground ml-1">
                        • {vendorPricing[0].vendor?.firm_name}
                      </span>
                    )}
                  </Link>
                ) : (
                  <span className="font-medium">
                    {vendorPricing[0].vendor?.name || "Unknown Vendor"}
                    {vendorPricing[0].vendor?.firm_name && (
                      <span className="text-muted-foreground ml-1">
                        • {vendorPricing[0].vendor?.firm_name}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Pricing Info */}
              <div className="flex items-center gap-6">
                {/* Price per piece */}
                <div className="text-sm">
                  <span className="text-muted-foreground mr-2">
                    Price per piece:
                  </span>
                  <span className="font-medium">
                    {vendorPricing[0].latestOrder?.currency || vendorPricing[0].currency === "INR"
                      ? "₹"
                      : vendorPricing[0].latestOrder?.currency || vendorPricing[0].currency}{" "}
                    {(vendorPricing[0].latestOrder?.unit_price || vendorPricing[0].price).toFixed(2)}
                  </span>
                </div>

                {/* Quantity from order */}
                {vendorPricing[0].latestOrder?.quantity && (
                  <div className="text-sm">
                    <span className="text-muted-foreground mr-2">Quantity:</span>
                    <span className="font-medium">
                      {vendorPricing[0].latestOrder.quantity} pieces
                    </span>
                  </div>
                )}

                {/* Total Price from order */}
                {vendorPricing[0].latestOrder?.total_amount && (
                  <div className="text-sm">
                    <span className="text-muted-foreground mr-2">Total:</span>
                    <span className="font-medium text-primary">
                      {vendorPricing[0].latestOrder.currency === "INR"
                        ? "₹"
                        : vendorPricing[0].latestOrder.currency}{" "}
                      {vendorPricing[0].latestOrder.total_amount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Multiple vendors badge */}
              {vendorPricing.length > 1 && (
                <Badge variant="secondary" className="text-xs">
                  +{vendorPricing.length - 1} more
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No vendor assigned to this stage
          </div>
        )}
      </div>

      <Separator />

      {/* Items Table */}
      <div className="flex-1 overflow-auto">
        {stageId && organizationId && (
          <ItemListTable stageId={stageId} organizationId={organizationId} />
        )}
      </div>

      {/* Vendor Assignment Modal */}
      {stageData && selectedSKU && stageId && (
        <AssignVendorModal
          sku={selectedSKU}
          stageId={stageId}
          stageName={stageData.name || ""}
          orderId={selectedOrderId}
          open={isVendorModalOpen}
          onOpenChange={setIsVendorModalOpen}
        />
      )}
    </div>
  );
}

// Main component wrapped in Suspense
export default function StageViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      }
    >
      <StageViewContent />
    </Suspense>
  );
}
