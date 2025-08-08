"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Dot,
  Package,
  Building2,
  ChevronsUpDown,
  Check,
  Wrench,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { cn } from "@/lib/utils";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useSKUs } from "@/hooks/queries/use-skus";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import {
  useStageItemCounts,
  calculateDetailedStageCount,
  calculateWorkflowItemsSummary,
} from "@/hooks/queries/use-stage-item-counts";
import { useWorkflowCostSummary } from "@/hooks/queries/use-workflow-cost-summary";
import { WorkflowCostSummaryCard } from "@/components/workflow-hub/workflow-cost-summary-card";
import { WorkflowItemsSummaryCard } from "@/components/workflow-hub/workflow-items-summary-card";
import { WorkflowReactFlow } from "@/components/workflow/WorkflowReactFlow";

// Use the types from useWorkflowStructure
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

export function WorkflowHubClient() {
  const router = useRouter();
  
  // Get organization ID for proper query key synchronization
  const { organizationId } = useProfileAndOrg();

  // Use global SKU selection context
  const { selectedSKU, setSelectedSKU } = useSKUSelection();
  const [skuSelectorOpen, setSKUSelectorOpen] = useState(false);

  // Get available SKUs
  const { data: skuData, isLoading: isLoadingSKUs } = useSKUs();

  // Get workflow structure for selected SKU
  const {
    data: workflowData,
    isLoading: isLoadingWorkflow,
    isError: isErrorWorkflow,
    error: errorWorkflow,
  } = useWorkflowStructure(organizationId, selectedSKU);

  // Get stage item counts for the selected SKU
  const { data: stageCountsData, isLoading: isLoadingStageCounts } =
    useStageItemCounts(organizationId, selectedSKU, workflowData);

  // Get workflow cost summary for the selected SKU
  const { data: costSummaryData, isLoading: isLoadingCostSummary } =
    useWorkflowCostSummary(organizationId, selectedSKU, workflowData);

  // Calculate workflow items summary
  const workflowItemsSummary = React.useMemo(() => {
    if (!workflowData || !stageCountsData?.stageCountsMap) {
      return {
        totalItems: 0,
        totalQuantity: 0,
        normalQuantity: 0,
        reworkedQuantity: 0,
        stagesWithItems: 0,
        totalStages: 0,
      };
    }
    return calculateWorkflowItemsSummary(workflowData, stageCountsData.stageCountsMap);
  }, [workflowData, stageCountsData]);

  // Available SKUs for the selector
  const availableSKUs = React.useMemo(() => {
    if (!skuData?.skus) return [];
    return skuData.skus.map((item) => ({
      value: item.sku,
      label: item.sku_name || item.sku,
    }));
  }, [skuData]);

  const handleStageClick = useCallback((stageId: string) => {
    router.push(`/workflow/${stageId}`);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* SKU Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select SKU Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={skuSelectorOpen} onOpenChange={setSKUSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={skuSelectorOpen}
                className="w-full justify-between text-left h-auto py-3"
                disabled={isLoadingSKUs}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {selectedSKU ? (
                    <>
                      <Package className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-base">
                          {availableSKUs.find(
                            (sku) => sku.value === selectedSKU
                          )?.label || selectedSKU}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Selected SKU Workflow
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-base">Select SKU</div>
                        <div className="text-sm text-muted-foreground">
                          Choose a SKU to view its workflow
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search SKUs..." />
                <CommandList>
                  <CommandEmpty>No SKUs found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        setSelectedSKU(null);
                        setSKUSelectorOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSKU === null ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">None</div>
                        <div className="text-xs text-muted-foreground">
                          No SKU selected
                        </div>
                      </div>
                    </CommandItem>
                    {availableSKUs.map((sku) => (
                      <CommandItem
                        key={sku.value}
                        value={sku.value}
                        onSelect={(currentValue) => {
                          setSelectedSKU(
                            currentValue === selectedSKU ? null : currentValue
                          );
                          setSKUSelectorOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSKU === sku.value
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <Package className="mr-2 h-4 w-4" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {sku.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {sku.value}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Summary Cards - Only show when SKU is selected */}
      {selectedSKU && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WorkflowItemsSummaryCard 
            itemsSummary={workflowItemsSummary}
            isLoading={isLoadingStageCounts}
          />
          <WorkflowCostSummaryCard 
            costSummary={costSummaryData}
            isLoading={isLoadingCostSummary}
          />
        </div>
      )}

      {/* Workflow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Structure</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingWorkflow && (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          
          {isErrorWorkflow && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>
                Error loading workflow:{" "}
                {errorWorkflow?.message || "Unknown error"}
              </AlertDescription>
            </Alert>
          )}
          
          {!isLoadingWorkflow &&
            !isErrorWorkflow &&
            (!workflowData || workflowData.length === 0) && (
              <div className="text-center py-8">
                <div className="mb-4">
                  <Wrench className="mx-auto h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Workflow Configured</h3>
                <p className="text-muted-foreground mb-4">
                  {selectedSKU
                    ? "This SKU doesn't have a workflow configured yet."
                    : "Select a SKU to view its workflow structure."}
                </p>
                {selectedSKU && (
                  <Button asChild>
                    <a href="/settings">Configure Workflow</a>
                  </Button>
                )}
              </div>
            )}
          
          {!isLoadingWorkflow &&
            !isErrorWorkflow &&
            workflowData &&
            workflowData.length > 0 && (
              <WorkflowReactFlow 
                workflowData={workflowData}
                stageCountsData={stageCountsData}
                isLoadingStageCounts={isLoadingStageCounts}
                onStageClick={handleStageClick}
                selectedSKU={selectedSKU}
              />
            )}
        </CardContent>
      </Card>
    </div>
  );
}