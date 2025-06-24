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
} from "lucide-react";
import {
  useWorkflowStructure,
  type FetchedWorkflowStage,
  type FetchedSubStage,
} from "@/hooks/queries/use-workflow-structure";
import { usePermissionCheck } from "@/hooks/queries/use-permission-check";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, InfoIcon } from "lucide-react";
import { AddStageModal } from "./add-stage-modal";
import { EditStageModal } from "./edit-stage-modal";
import { DeleteStageDialog } from "./delete-stage-dialog";
import { AddSubStageModal } from "./add-sub-stage-modal";
import { EditSubStageModal } from "./edit-sub-stage-modal";
import { DeleteSubStageDialog } from "./delete-sub-stage-dialog";
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

async function reorderSubStageApi(payload: ReorderPayload): Promise<void> {
  const response = await fetch("/api/settings/workflow/sub-stages/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || response.statusText || "Failed to reorder sub-stage"
    );
  }
}

interface WorkflowEditorProps {
  organizationId: string;
}

export function WorkflowEditor({ organizationId }: WorkflowEditorProps) {
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
    useState<FetchedSubStage | null>(null);
  const [deletingSubStage, setDeletingSubStage] =
    useState<FetchedSubStage | null>(null);

  // --- Fetch Workflow Structure ---
  const {
    data: workflowStructure,
    isLoading,
    error,
  } = useWorkflowStructure(organizationId);

  // --- Query Client for Invalidation ---
  const queryClient = useQueryClient();

  // --- Mutations for Reordering ---
  const reorderStageMutation = useMutation({
    mutationFn: reorderStageApi,
    onSuccess: () => {
      toast.success("Stage reordered successfully");
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder stage: ${error.message}`);
    },
  });

  const reorderSubStageMutation = useMutation({
    mutationFn: reorderSubStageApi,
    onSuccess: () => {
      toast.success("Sub-stage reordered successfully");
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder sub-stage: ${error.message}`);
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

  // Update Sub-stage Handlers
  const handleAddSubStage = (stage: FetchedWorkflowStage) =>
    setAddingSubStageTo(stage);
  const handleEditSubStage = (subStage: FetchedSubStage) =>
    setEditingSubStage(subStage);
  const handleDeleteSubStage = (subStage: FetchedSubStage) => {
    // Find the parent stage to check if this is the last sub-stage
    const parentStage = workflowStructure?.find((stage) =>
      stage.sub_stages.some((ss) => ss.id === subStage.id)
    );

    if (parentStage && parentStage.sub_stages.length === 1) {
      toast.error(
        "Cannot delete the last sub-stage. A stage with sub-stages must have at least one sub-stage."
      );
      return;
    }

    setDeletingSubStage(subStage);
  };

  const handleMoveSubStage = (id: string, direction: "up" | "down") => {
    if (reorderSubStageMutation.isPending) return;
    reorderSubStageMutation.mutate({ itemId: id, direction });
  };

  // --- Calculations ---
  const calculateNextSubStageSequence = (
    stage: FetchedWorkflowStage | null
  ): number => {
    if (!stage) return 1;
    return stage.sub_stages.length + 1;
  };

  const isPending =
    reorderStageMutation.isPending || reorderSubStageMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Workflow Rules Alert */}
      <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <InfoIcon className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Workflow Rules:</strong> Sub-stages can only be added during
          stage creation. Once created, stages with sub-stages must always have
          at least one sub-stage. Items can only be moved to sub-stages, not to
          the parent stage when sub-stages exist.
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
                            <div className="w-12 h-12 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                              <span className="text-lg font-bold text-primary">
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
                            {stage.sub_stages.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <LayersIcon className="h-3 w-3 mr-1" />
                                {stage.sub_stages.length} sub-stages
                              </Badge>
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

                        {/* Add Sub-stage Button */}
                        {stage.sub_stages.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-green-50 border-green-200 border text-green-600 hover:bg-green-100 hover:border-green-300 hover:text-green-700 transition-all duration-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/50 dark:hover:border-green-700 dark:hover:text-green-300"
                            title="Add Sub-stage"
                            onClick={() => handleAddSubStage(stage)}
                            disabled={isPending}
                          >
                            <PlusIcon className="h-4 w-4" />
                          </Button>
                        )}

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

                    {/* Sub-stages Section */}
                    {stage.sub_stages.length > 0 ? (
                      <div className="space-y-3">
                        <Separator className="my-4" />
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Sub-stages
                          </h4>
                        </div>
                        <div className="space-y-2 ml-6">
                          {stage.sub_stages
                            .sort((a, b) => a.sequence_order - b.sequence_order)
                            .map(
                              (
                                subStage: FetchedSubStage,
                                subStageIndex: number
                              ) => (
                                <Card
                                  key={subStage.id}
                                  className="border-border/30 bg-muted/20 hover:bg-muted/40 transition-all duration-150"
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/5 border-2 border-primary/10 flex items-center justify-center">
                                          <span className="text-sm font-bold text-primary">
                                            {stage.sequence_order}.
                                            {subStage.sequence_order}
                                          </span>
                                        </div>
                                        <div>
                                          <h5 className="text-sm font-medium text-foreground">
                                            {subStage.name}
                                          </h5>
                                          <p className="text-xs text-muted-foreground">
                                            Sub-stage {subStage.sequence_order}{" "}
                                            of {stage.name}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 bg-blue-50 border-blue-200 border text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:hover:border-blue-700 dark:hover:text-blue-300"
                                          title="Move Sub-stage Up"
                                          onClick={() =>
                                            handleMoveSubStage(
                                              subStage.id,
                                              "up"
                                            )
                                          }
                                          disabled={
                                            subStageIndex === 0 || isPending
                                          }
                                        >
                                          <ArrowUpIcon className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 bg-blue-50 border-blue-200 border text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:hover:border-blue-700 dark:hover:text-blue-300"
                                          title="Move Sub-stage Down"
                                          onClick={() =>
                                            handleMoveSubStage(
                                              subStage.id,
                                              "down"
                                            )
                                          }
                                          disabled={
                                            subStageIndex ===
                                              stage.sub_stages.length - 1 ||
                                            isPending
                                          }
                                        >
                                          <ArrowDownIcon className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 bg-amber-50 border-amber-200 border text-amber-600 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-700 transition-all duration-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:hover:border-amber-700 dark:hover:text-amber-300"
                                          title="Edit Sub-stage"
                                          onClick={() =>
                                            handleEditSubStage(subStage)
                                          }
                                          disabled={isPending}
                                        >
                                          <PencilIcon className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 bg-red-50 border-red-200 border text-red-600 hover:bg-red-100 hover:border-red-300 hover:text-red-700 transition-all duration-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:border-red-700 dark:hover:text-red-300"
                                          title="Delete Sub-stage"
                                          onClick={() =>
                                            handleDeleteSubStage(subStage)
                                          }
                                          disabled={isPending}
                                        >
                                          <TrashIcon className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <Separator className="mb-4" />
                        <div className="bg-muted/30 rounded-lg p-4 border border-dashed border-border/50">
                          <p className="text-sm text-muted-foreground text-center">
                            {isCompleted
                              ? "🎉 This is the final stage where all completed items are stored."
                              : "No sub-stages defined. Sub-stages can only be added during stage creation."}
                          </p>
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
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
      />
      <EditStageModal
        organizationId={organizationId}
        isOpen={!!editingStage}
        onClose={() => setEditingStage(null)}
        stage={editingStage}
      />
      <DeleteStageDialog
        organizationId={organizationId}
        isOpen={!!deletingStage}
        onClose={() => setDeletingStage(null)}
        stage={deletingStage}
      />

      <AddSubStageModal
        organizationId={organizationId}
        isOpen={!!addingSubStageTo}
        onClose={() => setAddingSubStageTo(null)}
        stageId={addingSubStageTo?.id ?? null}
        nextSequenceOrder={calculateNextSubStageSequence(addingSubStageTo)}
      />
      <EditSubStageModal
        organizationId={organizationId}
        isOpen={!!editingSubStage}
        onClose={() => setEditingSubStage(null)}
        subStage={editingSubStage}
      />
      <DeleteSubStageDialog
        organizationId={organizationId}
        isOpen={!!deletingSubStage}
        onClose={() => setDeletingSubStage(null)}
        subStage={deletingSubStage}
      />
    </div>
  );
}
