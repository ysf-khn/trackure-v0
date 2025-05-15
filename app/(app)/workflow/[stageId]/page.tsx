"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MapPin, Terminal, Users } from "lucide-react";

import { ItemListTable } from "@/components/items/item-list-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { useSubStage } from "@/hooks/queries/use-sub-stage";
import { Suspense } from "react";

// Define types for stage and substage data
interface StageData {
  id: string;
  name: string | null;
  sequence_order: number;
  location: string | null;
}

interface SubStageData {
  id: string;
  name: string | null;
  sequence_order: number;
  location: string | null;
}

export default function StageViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  // --- Authentication ---
  const {
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();

  // --- Stage/SubStage IDs ---
  const stageId = params.stageId as string | undefined;
  // Correctly handle null from searchParams.get, pass undefined if null
  const subStageId = searchParams.get("subStage") ?? undefined; // Fix linter error here

  // --- Fetch Stage Data ---
  const {
    data: stageData,
    isLoading: isStageLoading,
    isError: isStageError,
    error: stageError,
  } = useStage(stageId, organizationId);

  // --- Fetch Sub-Stage Data (Conditional) ---
  const {
    data: subStageData,
    isLoading: isSubStageLoading,
    isError: isSubStageError,
    error: subStageError,
  } = useSubStage(subStageId ?? null, organizationId!); // Pass null if undefined

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
      <Alert variant="destructive" className="m-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Stage Not Found</AlertTitle>
        <AlertDescription>
          The requested stage ({stageId}) could not be found or you do not have
          permission to view it.
        </AlertDescription>
      </Alert>
    );
  }

  // --- Render Page Content ---
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="container mx-auto py-4 px-4 md:px-6 space-y-4">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>Workflow</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {!subStageId ? (
                <BreadcrumbPage>
                  {stageData?.name ?? `Stage ${stageId.substring(0, 6)}`}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbItem>
                  {stageData?.name ?? `Stage ${stageId.substring(0, 6)}`}
                </BreadcrumbItem>
              )}
            </BreadcrumbItem>
            {subStageId && subStageData && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {subStageData?.name ??
                      `Sub-stage ${subStageId.substring(0, 6)}`}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Stage Information Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">
                {stageData?.name ?? `Stage ${stageId.substring(0, 6)}`}
              </h1>
              <Badge variant="outline" className="text-sm">
                Sequence Order: {stageData?.sequence_order ?? "?"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Stage Metadata */}
              <div className="flex items-center space-x-4">
                {stageData?.location && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-1" />
                    {stageData.location}
                  </div>
                )}
                {/* <div className="flex items-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-1" />
                {/* This is a placeholder - you might want to add actual worker count }
                3 Workers Assigned
              </div> */}
              </div>

              {/* Separator between metadata and substage (if present) */}
              {subStageId && <Separator className="" />}

              {/* Sub-Stage Information (if present) */}
              {subStageId && (
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    Current Sub-stage
                  </h3>
                  {isSubStageLoading ? (
                    <Skeleton className="h-5 w-1/3" />
                  ) : isSubStageError ? (
                    <span className="text-sm text-destructive">
                      Error loading sub-stage:{" "}
                      {subStageError?.message || "Unknown error"}
                    </span>
                  ) : subStageData ? (
                    <div className="space-y-2">
                      <p className="text-lg">
                        {subStageData.name ??
                          `Sub-stage ${subStageId.substring(0, 6)}`}
                      </p>
                      {subStageData.location && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-1" />
                          {subStageData.location}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sub-Stage: {subStageId} (Details not found)
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardContent className="p-4">
            <ItemListTable
              organizationId={organizationId}
              stageId={stageId}
              subStageId={subStageId ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </Suspense>
  );
}
