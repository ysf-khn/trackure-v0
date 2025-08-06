"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { MapPin, Terminal } from "lucide-react";

import { ItemListTable } from "@/components/items/item-list-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VendorPricingCard } from "@/components/workflow/vendor-pricing-card";
import { useSingleStageItemCounts } from "@/hooks/queries/use-single-stage-item-counts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useStage } from "@/hooks/queries/use-stage";
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

  // --- Authentication ---
  const {
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();

  // --- Stage ID ---
  const stageId = params.stageId as string | undefined;
  // In the tree structure, we no longer have separate sub-stages
  // Everything is a workflow_stages entry with possible parent_stage_id
  const subStageId: string | null = null;

  // --- Fetch Stage Data ---
  const {
    data: stageData,
    isLoading: isStageLoading,
    isError: isStageError,
    error: stageError,
  } = useStage(stageId, organizationId);

  // --- Fetch Stage Item Counts ---
  const {
    data: stageItemCounts,
    isLoading: isLoadingItemCounts,
  } = useSingleStageItemCounts(organizationId, stageId, stageData?.sku);

  // Note: With tree structure, we no longer need separate sub-stage queries
  // All stages (including what were sub-stages) are in workflow_stages table

  // --- Loading and Error States ---
  if (isAuthLoading || isStageLoading) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6 space-y-4">
        {/* Loading state for breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/workflow">Workflow</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Skeleton className="h-5 w-32" />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Loading state for stage info card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Skeleton className="h-7 w-32" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-24 w-full rounded-md" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading state for table */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-9 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authentication Error (higher priority)
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

  // Missing Org ID (higher priority)
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

  // Missing Stage ID (higher priority)
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

  // Stage not found (or RLS prevented access - handle appropriately)
  if (!stageData) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6 space-y-4">
        <Alert variant="destructive" className="m-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Stage Not Found</AlertTitle>
          <AlertDescription>
            The requested stage could not be found or you do not have access to
            it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Main Content ---
  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-4">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Workflow</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{stageData?.name || "Unnamed Stage"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Stage Info Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">
                {stageData?.name || "Unnamed Stage"}
              </h2>
              {/* Display parent stage info if this is a child stage */}
              {stageData?.parent_stage_id && stageData?.full_path && (
                <span className="text-muted-foreground text-sm">
                  ({stageData.full_path})
                </span>
              )}
            </div>
            <Badge variant="outline">
              Sequence Order: {(stageData?.sequence_order ?? 0) + 1}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {stageData?.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{stageData.location}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendor Pricing Card - Only show for leaf stages with SKU */}
      {stageData?.is_leaf_stage && stageData?.sku && stageId && (
        <VendorPricingCard 
          stageId={stageId}
          stageName={stageData?.name || "Unnamed Stage"}
          itemCount={stageItemCounts?.itemCount || 0}
          totalQuantity={stageItemCounts?.totalQuantity || 0}
        />
      )}

      {/* Items Table */}
      <Card>
        <CardContent className="p-4">
          {stageId && organizationId && (
            <ItemListTable
              stageId={stageId}
              organizationId={organizationId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Main component wrapped in Suspense
export default function StageViewPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      }
    >
      <StageViewContent />
    </Suspense>
  );
}
