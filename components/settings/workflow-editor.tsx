"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  WorkflowIcon,
  ChevronRightIcon,
  Settings2Icon,
  LayersIcon,
  DollarSignIcon,
} from "lucide-react";
import {
  useWorkflowStructure,
  type FetchedWorkflowStage,
} from "@/hooks/queries/use-workflow-structure";
import { usePermissionCheck } from "@/hooks/queries/use-permission-check";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, InfoIcon } from "lucide-react";
import { AddStageModal } from "./add-stage-modal";
import { EditStageModal } from "./edit-stage-modal";
import { DeleteStageDialog } from "./delete-stage-dialog";
import { VendorPricingModal } from "./vendor-pricing-modal";
import { VendorPricingBadge } from "./vendor-pricing-badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure";
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ReorderPayload {
  itemId: string;
  direction: "up" | "down";
}

// Recursive component for rendering infinite nesting
interface RecursiveStageRendererProps {
  stages: FetchedWorkflowStage[];
  depth: number;
  parentStage: FetchedWorkflowStage;
  isPending: boolean;
  handleAddChildStage: (stage: FetchedWorkflowStage) => void;
  handleEditStage: (stage: FetchedWorkflowStage) => void;
  handleDeleteStage: (stage: FetchedWorkflowStage) => void;
  handleMoveStage: (id: string, direction: "up" | "down") => void;
  handleVendorPricing: (stage: FetchedWorkflowStage) => void;
  selectedSKU: string | null;
}

const RecursiveStageRenderer: React.FC<RecursiveStageRendererProps> = ({
  stages,
  depth,
  parentStage,
  isPending,
  handleAddChildStage,
  handleEditStage,
  handleDeleteStage,
  handleMoveStage,
  handleVendorPricing,
  selectedSKU,
}) => {
  return (
    <>
      {stages.map((childStage, childStageIndex) => (
        <div key={childStage.id} className="space-y-2">
          <Card className="border-border/30 bg-muted/20 hover:bg-muted/40 transition-all duration-150">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-primary/5 to-primary/10 rounded-full border border-primary/20">
                      {(childStage.full_path || `${parentStage.sequence_order}.${childStage.sequence_order}`)
                        .split('.')
                        .map((segment, index, array) => (
                          <React.Fragment key={index}>
                            <span className="text-sm font-semibold text-primary/80 font-mono">
                              {segment}
                            </span>
                            {index < array.length - 1 && (
                              <ChevronRightIcon className="h-3 w-3 text-primary/40" />
                            )}
                          </React.Fragment>
                        ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium text-foreground">
                        {childStage.name}
                      </h5>
                      {childStage.is_leaf_stage && selectedSKU && (
                        <VendorPricingBadge count={childStage.vendor_pricing_count || 0} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Level {depth} - Stage {childStage.sequence_order}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {/* Add Sub-stage Button for infinite nesting */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-green-50 border-green-200 border text-green-600 hover:bg-green-100 hover:border-green-300 hover:text-green-700 transition-all duration-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/50 dark:hover:border-green-700 dark:hover:text-green-300"
                    title="Add Child Stage"
                    onClick={() => handleAddChildStage(childStage)}
                    disabled={isPending}
                  >
                    <PlusIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-blue-50 border-blue-200 border text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:hover:border-blue-700 dark:hover:text-blue-300"
                    title="Move Stage Up"
                    onClick={() => handleMoveStage(childStage.id, "up")}
                    disabled={childStageIndex === 0 || isPending}
                  >
                    <ArrowUpIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-blue-50 border-blue-200 border text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:hover:border-blue-700 dark:hover:text-blue-300"
                    title="Move Stage Down"
                    onClick={() => handleMoveStage(childStage.id, "down")}
                    disabled={childStageIndex === stages.length - 1 || isPending}
                  >
                    <ArrowDownIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-amber-50 border-amber-200 border text-amber-600 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-700 transition-all duration-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:hover:border-amber-700 dark:hover:text-amber-300"
                    title="Edit Stage"
                    onClick={() => handleEditStage(childStage)}
                    disabled={isPending}
                  >
                    <PencilIcon className="h-3 w-3" />
                  </Button>
                  {/* Only show vendor pricing button for leaf stages with SKU */}
                  {childStage.is_leaf_stage && selectedSKU && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-purple-50 border-purple-200 border text-purple-600 hover:bg-purple-100 hover:border-purple-300 hover:text-purple-700 transition-all duration-200 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/50 dark:hover:border-purple-700 dark:hover:text-purple-300"
                      title="Manage Vendor Pricing"
                      onClick={() => handleVendorPricing(childStage)}
                      disabled={isPending}
                    >
                      <DollarSignIcon className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-red-50 border-red-200 border text-red-600 hover:bg-red-100 hover:border-red-300 hover:text-red-700 transition-all duration-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:border-red-700 dark:hover:text-red-300"
                    title="Delete Stage"
                    onClick={() => handleDeleteStage(childStage)}
                    disabled={isPending}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Recursive rendering for nested stages */}
          {childStage.children && childStage.children.length > 0 && (
            <div className="ml-6 space-y-2">
              <RecursiveStageRenderer
                stages={childStage.children}
                depth={depth + 1}
                parentStage={childStage}
                isPending={isPending}
                handleAddChildStage={handleAddChildStage}
                handleEditStage={handleEditStage}
                handleDeleteStage={handleDeleteStage}
                handleMoveStage={handleMoveStage}
                handleVendorPricing={handleVendorPricing}
                selectedSKU={selectedSKU}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
};

async function reorderStageApi(payload: ReorderPayload): Promise<void> {
  const response = await fetch("/api/settings/workflow/stages/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || response.statusText || "Failed to reorder stage"
    );
  }
}


interface WorkflowEditorProps {
  organizationId: string;
  selectedSKU: string | null;
}

export function WorkflowEditor({ organizationId, selectedSKU }: WorkflowEditorProps) {
  // Check if user has permission to edit workflow
  const canEditWorkflow = usePermissionCheck("workflow.edit");

  // --- State for Stage Modals/Dialogs ---
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<FetchedWorkflowStage | null>(
    null
  );
  const [deletingStage, setDeletingStage] =
    useState<FetchedWorkflowStage | null>(null);

  // --- State for Sub-stage Modals/Dialogs ---
  const [addingSubStageTo, setAddingSubStageTo] =
    useState<FetchedWorkflowStage | null>(null);
  const [editingSubStage, setEditingSubStage] =
    useState<FetchedWorkflowStage | null>(null);
  const [deletingSubStage, setDeletingSubStage] =
    useState<FetchedWorkflowStage | null>(null);

  // --- State for Vendor Pricing Modal ---
  const [vendorPricingStage, setVendorPricingStage] =
    useState<FetchedWorkflowStage | null>(null);

  // --- Fetch Workflow Structure ---
  const {
    data: workflowStructure,
    isLoading,
    error,
  } = useWorkflowStructure(organizationId, selectedSKU);

  // --- Query Client for Invalidation ---
  const queryClient = useQueryClient();

  // --- Mutations for Reordering ---
  const reorderStageMutation = useMutation({
    mutationFn: reorderStageApi,
    onSuccess: () => {
      toast.success("Stage reordered successfully");
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId, selectedSKU),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder stage: ${error.message}`);
    },
  });


  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>
        </Card>

        {/* Stages Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-40" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                  <div className="ml-6 space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <Alert
        variant="destructive"
        className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30"
      >
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Workflow</AlertTitle>
        <AlertDescription>
          Failed to load workflow structure: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  // --- No Permission State ---
  if (!canEditWorkflow) {
    return (
      <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
        <InfoIcon className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          Access Restricted
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          You don't have permission to edit the workflow. Only users with
          workflow editing permissions can modify stages and sub-stages.
        </AlertDescription>
      </Alert>
    );
  }

  // --- Helper Functions ---
  const isCompletedStage = (stage: FetchedWorkflowStage): boolean => {
    return stage.name?.toLowerCase().includes("completed") ?? false;
  };

  // Sort workflow structure by sequence_order
  const sortedWorkflowStructure = workflowStructure
    ? [...workflowStructure].sort((a, b) => a.sequence_order - b.sequence_order)
    : [];

  // --- Event Handlers ---
  const handleAddStage = () => setIsAddStageModalOpen(true);
  const handleEditStage = (stage: FetchedWorkflowStage) =>
    setEditingStage(stage);

  const handleDeleteStage = (stage: FetchedWorkflowStage) => {
    // Prevent deletion of completed stage
    if (isCompletedStage(stage)) {
      toast.error(
        "The 'Completed' stage cannot be deleted as it's required by the system."
      );
      return;
    }
    setDeletingStage(stage);
  };

  // Placeholder handlers - these will be implemented in later steps or remain as placeholders
  const handleMoveStage = (id: string, direction: "up" | "down") => {
    if (reorderStageMutation.isPending) return;

    // Find the stage being moved
    const stage = workflowStructure?.find((s) => s.id === id);
    if (stage && isCompletedStage(stage)) {
      toast.error(
        "The 'Completed' stage cannot be moved as it must remain the final stage."
      );
      return;
    }

    reorderStageMutation.mutate({ itemId: id, direction });
  };

  // Update Child Stage Handlers
  const handleAddChildStage = (stage: FetchedWorkflowStage) =>
    setAddingSubStageTo(stage);
  const handleEditChildStage = (stage: FetchedWorkflowStage) =>
    setEditingStage(stage);
  const handleDeleteChildStage = (stage: FetchedWorkflowStage) => {
    setDeletingStage(stage);
  };

  const handleVendorPricing = (stage: FetchedWorkflowStage) =>
    setVendorPricingStage(stage);


  // --- Calculations ---
  const calculateNextChildStageSequence = (
    stage: FetchedWorkflowStage | null
  ): number => {
    if (!stage) return 1;
    return (stage.children?.length || 0) + 1;
  };

  const isPending = reorderStageMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Workflow Rules Alert */}
      <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <InfoIcon className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Workflow Rules:</strong> Stages can be nested infinitely to create
          a tree structure. Items can only be allocated to leaf stages (stages without children).
          You can add child stages to any existing stage to create deeper workflow levels.
        </AlertDescription>
      </Alert>

      {/* Main Workflow Card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <WorkflowIcon className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl font-semibold">
                  Workflow Structure
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage your organization's workflow stages and processes
              </p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-sm"
              onClick={handleAddStage}
              size="sm"
              disabled={isPending}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Stage
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {sortedWorkflowStructure.map((stage, stageIndex) => {
              const isCompleted = isCompletedStage(stage);
              const isFirstNonCompletedStage = stageIndex === 0 && !isCompleted;

              // Fix: Check if this is the last non-completed stage
              // Find the last non-completed stage in the sorted array
              const lastNonCompletedStageIndex = sortedWorkflowStructure
                .map((s, index) => ({ stage: s, index }))
                .filter(({ stage }) => !isCompletedStage(stage))
                .pop()?.index;

              const isLastNonCompletedStage =
                !isCompleted && stageIndex === lastNonCompletedStageIndex;

              return (
                <Card
                  key={stage.id}
                  className={`transition-all duration-200 hover:shadow-md ${
                    isCompleted
                      ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20"
                      : "border-border/50 bg-card hover:border-border"
                  } ${isPending ? "opacity-70" : ""}`}
                >
                  <CardContent className="p-6">
                    {/* Stage Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center border-2 border-green-200 dark:border-green-800">
                              <WorkflowIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-primary/5 to-primary/10 rounded-full border border-primary/20">
                              <span className="text-lg font-bold text-primary/80 font-mono">
                                {stage.sequence_order}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {stage.name}
                            </h3>
                            {isCompleted && (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"
                              >
                                <Settings2Icon className="h-3 w-3 mr-1" />
                                System Required
                              </Badge>
                            )}
                            {stage.children && stage.children.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <LayersIcon className="h-3 w-3 mr-1" />
                                {stage.children.length} child stages
                              </Badge>
                            )}
                            {stage.is_leaf_stage && selectedSKU && (
                              <VendorPricingBadge count={stage.vendor_pricing_count || 0} />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {isCompleted
                              ? "Final stage for completed items"
                              : `Stage ${stage.sequence_order} in your workflow`}
                          </p>
                        </div>
                      </div>

                      {/* Stage Actions */}
                      <div className="flex items-center space-x-1">
                        {/* Move Up Button */}
                        {!isCompleted && !isFirstNonCompletedStage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-blue-50 border-blue-200 border text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:hover:border-blue-700 dark:hover:text-blue-300"
                            title="Move Stage Up"
                            onClick={() => handleMoveStage(stage.id, "up")}
                            disabled={isPending}
                          >
                            <ArrowUpIcon className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Move Down Button */}
                        {!isCompleted && !isLastNonCompletedStage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-blue-50 border-blue-200 border text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:hover:border-blue-700 dark:hover:text-blue-300"
                            title="Move Stage Down"
                            onClick={() => handleMoveStage(stage.id, "down")}
                            disabled={isPending}
                          >
                            <ArrowDownIcon className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Add Sub-stage Button - Allow infinite nesting */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 bg-green-50 border-green-200 border text-green-600 hover:bg-green-100 hover:border-green-300 hover:text-green-700 transition-all duration-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/50 dark:hover:border-green-700 dark:hover:text-green-300"
                          title="Add Child Stage"
                          onClick={() => handleAddChildStage(stage)}
                          disabled={isPending}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>

                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 bg-amber-50 border-amber-200 border text-amber-600 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-700 transition-all duration-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:hover:border-amber-700 dark:hover:text-amber-300"
                          title={
                            isCompleted ? "Edit Stage (Limited)" : "Edit Stage"
                          }
                          onClick={() => handleEditStage(stage)}
                          disabled={isPending}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>

                        {/* Vendor Pricing Button - Only for leaf stages with SKU */}
                        {stage.is_leaf_stage && selectedSKU && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-purple-50 border-purple-200 border text-purple-600 hover:bg-purple-100 hover:border-purple-300 hover:text-purple-700 transition-all duration-200 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/50 dark:hover:border-purple-700 dark:hover:text-purple-300"
                            title="Manage Vendor Pricing"
                            onClick={() => handleVendorPricing(stage)}
                            disabled={isPending}
                          >
                            <DollarSignIcon className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Delete Button */}
                        {!isCompleted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-red-50 border-red-200 border text-red-600 hover:bg-red-100 hover:border-red-300 hover:text-red-700 transition-all duration-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:border-red-700 dark:hover:text-red-300"
                            title="Delete Stage"
                            onClick={() => handleDeleteStage(stage)}
                            disabled={isPending}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Child stages Section - Recursive rendering */}
                    {stage.children && stage.children.length > 0 && (
                      <div className="space-y-3">
                        <Separator className="my-4" />
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Sub-stages
                          </h4>
                        </div>
                        <div className="space-y-2 ml-6">
                          <RecursiveStageRenderer 
                            stages={stage.children}
                            depth={1}
                            parentStage={stage}
                            isPending={isPending}
                            handleAddChildStage={handleAddChildStage}
                            handleEditStage={handleEditStage}
                            handleDeleteStage={handleDeleteStage}
                            handleMoveStage={handleMoveStage}
                            handleVendorPricing={handleVendorPricing}
                            selectedSKU={selectedSKU}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <AddStageModal
        organizationId={organizationId}
        selectedSKU={selectedSKU}
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
      />
      <EditStageModal
        organizationId={organizationId}
        selectedSKU={selectedSKU}
        isOpen={!!editingStage}
        onClose={() => setEditingStage(null)}
        stage={editingStage}
      />
      <DeleteStageDialog
        organizationId={organizationId}
        selectedSKU={selectedSKU}
        isOpen={!!deletingStage}
        onClose={() => setDeletingStage(null)}
        stage={deletingStage}
      />
      <VendorPricingModal
        organizationId={organizationId}
        selectedSKU={selectedSKU}
        isOpen={!!vendorPricingStage}
        onClose={() => setVendorPricingStage(null)}
        stage={vendorPricingStage}
      />

      {/* Child stage modals would go here - using AddStageModal with parent_stage_id */}
    </div>
  );
}
