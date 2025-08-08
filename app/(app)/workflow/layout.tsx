"use client";

import * as React from "react";
import { useParams, usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { WorkflowReactFlowCompact } from "@/components/workflow/WorkflowReactFlowCompact";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import { useStageItemCounts } from "@/hooks/queries/use-stage-item-counts";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { organizationId } = useProfileAndOrg();
  const { selectedSKU } = useSKUSelection();
  
  // Extract stageId from pathname
  const stageId = pathname?.split("/workflow/")[1] || undefined;
  
  // Get workflow structure
  const { data: workflowData, isLoading: isLoadingWorkflow } =
    useWorkflowStructure(organizationId, selectedSKU);
  
  // Get stage item counts for the workflow
  const { data: stageCountsData, isLoading: isLoadingStageCounts } =
    useStageItemCounts(organizationId, selectedSKU, workflowData);
  
  // Handle stage navigation - no longer needed as we use Link component
  const handleStageClick = React.useCallback(
    (clickedStageId: string) => {
      // Navigation is handled by Link component in StageNode
      // This is kept for compatibility but could be removed
    },
    []
  );
  
  return (
    <div className="h-full flex flex-col px-6 py-2 space-y-3">
      {/* Workflow Tree Visualization - Persists across stage navigation */}
      {isLoadingWorkflow ? (
        <div className="flex-shrink-0">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : workflowData && workflowData.length > 0 ? (
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
      ) : null}
      
      {/* Page content (stage details and items table) */}
      {children}
    </div>
  );
}