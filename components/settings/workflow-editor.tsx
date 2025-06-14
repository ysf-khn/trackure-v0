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
} from "lucide-react";
import {
  useWorkflowStructure,
  type FetchedWorkflowStage,
  type FetchedSubStage,
} from "@/hooks/queries/use-workflow-structure";
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
  // --- State for Stage Modals/Dialogs ---
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<FetchedWorkflowStage | null>(
    null
  );
  const [deletingStage, setDeletingStage] =
    useState<FetchedWorkflowStage | null>(null);

  // --- State for Sub-Stage Modals/Dialogs ---
  const [addingSubStageTo, setAddingSubStageTo] =
    useState<FetchedWorkflowStage | null>(null);
  const [editingSubStage, setEditingSubStage] =
    useState<FetchedSubStage | null>(null);
  const [deletingSubStage, setDeletingSubStage] =
    useState<FetchedSubStage | null>(null);

  const queryClient = useQueryClient();

  // --- Data Fetching ---
  const {
    data: workflowStructure,
    isLoading,
    isError,
    error,
  } = useWorkflowStructure(organizationId);

  // --- Helper Functions ---
  const isCompletedStage = (stage: FetchedWorkflowStage): boolean => {
    return stage.name?.toLowerCase() === "completed";
  };

  // Sort workflow to ensure Completed stage is always last
  const sortedWorkflowStructure = React.useMemo(() => {
    if (!workflowStructure) return [];

    const regularStages = workflowStructure.filter(
      (stage) => !isCompletedStage(stage)
    );
    const completedStages = workflowStructure.filter((stage) =>
      isCompletedStage(stage)
    );

    // Sort regular stages by sequence_order, then append completed stages
    const sortedRegular = regularStages.sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
    const sortedCompleted = completedStages.sort(
      (a, b) => a.sequence_order - b.sequence_order
    );

    return [...sortedRegular, ...sortedCompleted];
  }, [workflowStructure]);

  // --- Mutations ---
  const reorderStageMutation = useMutation({
    mutationFn: reorderStageApi,
    onSuccess: () => {
      toast.success("Stage reordered successfully.");
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Error reordering stage: ${error.message}`);
    },
  });

  const reorderSubStageMutation = useMutation({
    mutationFn: reorderSubStageApi,
    onSuccess: () => {
      toast.success("Sub-stage reordered successfully.");
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Error reordering sub-stage: ${error.message}`);
    },
  });

  // --- Loading State ---
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full border rounded-md p-4" />
          <Skeleton className="h-24 w-full border rounded-md p-4" />
        </CardContent>
      </Card>
    );
  }

  // --- Error State ---
  if (isError) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Workflow</AlertTitle>
        <AlertDescription>
          There was a problem fetching the workflow structure:{" "}
          {error?.message || "Unknown error"}. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  // --- Empty State ---
  const isEmpty = !workflowStructure || workflowStructure.length === 0;

  if (isEmpty) {
    return (
      <>
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Workflow Rules:</strong> Sub-stages can only be added during
            stage creation. Once created, stages with sub-stages must always
            have at least one sub-stage. Items can only be moved to sub-stages,
            not to the parent stage when sub-stages exist.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Workflow Structure</CardTitle>
            <Button onClick={() => setIsAddStageModalOpen(true)} size="sm">
              <PlusIcon className="mr-2 h-4 w-4" /> Add Stage
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">
              No workflow stages defined yet. Click &apos;Add Stage&apos; to get
              started.
            </p>
          </CardContent>
        </Card>
        <AddStageModal
          organizationId={organizationId}
          isOpen={isAddStageModalOpen}
          onClose={() => setIsAddStageModalOpen(false)}
        />
      </>
    );
  }

  // --- Success State (Data available) ---

  // --- Event Handlers ---
  const handleAddStage = () => setIsAddStageModalOpen(true);

  const handleEditStage = (stage: FetchedWorkflowStage) => {
    // Allow editing of completed stage but with restrictions
    setEditingStage(stage);
  };

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

  return (
    <>
      <Alert className="mb-4">
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          <strong>Workflow Rules:</strong> Sub-stages can only be added during
          stage creation. Once created, stages with sub-stages must always have
          at least one sub-stage. Items can only be moved to sub-stages, not to
          the parent stage when sub-stages exist.
        </AlertDescription>
      </Alert>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Workflow Structure</CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={handleAddStage}
              size="sm"
              disabled={
                reorderStageMutation.isPending ||
                reorderSubStageMutation.isPending
              }
            >
              <PlusIcon className="mr-2 h-4 w-4" /> Add Stage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedWorkflowStructure.map((stage, stageIndex) => {
              const isCompleted = isCompletedStage(stage);
              const isFirstNonCompletedStage = stageIndex === 0 && !isCompleted;
              const isLastNonCompletedStage =
                stageIndex ===
                  sortedWorkflowStructure.filter((s) => !isCompletedStage(s))
                    .length -
                    1 && !isCompleted;

              // Calculate display sequence order (normalized for user display)
              const displaySequenceOrder = isCompleted
                ? sortedWorkflowStructure.length // Show as last
                : stageIndex + 1; // Show 1, 2, 3, etc.

              return (
                <div
                  key={stage.id}
                  className={`rounded-md border p-4 ${isCompleted ? "border-green-200 bg-green-50/30" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        {`${displaySequenceOrder}. ${stage.name}`}
                        {isCompleted && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            System Stage
                          </span>
                        )}
                      </h4>
                      {stage.location && (
                        <p className="text-sm text-muted-foreground">
                          Location: {stage.location}
                        </p>
                      )}
                      {isCompleted && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This stage is automatically managed by the system and
                          must remain as the final stage.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Move Up Button - hidden for completed stages and first stage */}
                      {!isCompleted && !isFirstNonCompletedStage && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Move Stage Up"
                          onClick={() => handleMoveStage(stage.id, "up")}
                          disabled={
                            reorderStageMutation.isPending ||
                            reorderSubStageMutation.isPending
                          }
                        >
                          <ArrowUpIcon className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Move Down Button - hidden for completed stages and when next stage is completed */}
                      {!isCompleted && !isLastNonCompletedStage && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Move Stage Down"
                          onClick={() => handleMoveStage(stage.id, "down")}
                          disabled={
                            reorderStageMutation.isPending ||
                            reorderSubStageMutation.isPending
                          }
                        >
                          <ArrowDownIcon className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Add Sub-stage Button - Only show for stages that already have sub-stages */}
                      {stage.sub_stages.length > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Add Sub-stage"
                          onClick={() => handleAddSubStage(stage)}
                          disabled={
                            reorderStageMutation.isPending ||
                            reorderSubStageMutation.isPending
                          }
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Edit Button */}
                      <Button
                        variant="outline"
                        size="icon"
                        title={
                          isCompleted ? "Edit Stage (Limited)" : "Edit Stage"
                        }
                        onClick={() => handleEditStage(stage)}
                        disabled={
                          reorderStageMutation.isPending ||
                          reorderSubStageMutation.isPending
                        }
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>

                      {/* Delete Button - hidden for completed stages */}
                      {!isCompleted && (
                        <Button
                          variant="destructive"
                          size="icon"
                          title="Delete Stage"
                          onClick={() => handleDeleteStage(stage)}
                          disabled={
                            reorderStageMutation.isPending ||
                            reorderSubStageMutation.isPending
                          }
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Sub-stages List */}
                  {stage.sub_stages.length > 0 && (
                    <div className="ml-6 mt-3 space-y-2 border-l pl-4">
                      {stage.sub_stages
                        .sort(
                          (a: FetchedSubStage, b: FetchedSubStage) =>
                            a.sequence_order - b.sequence_order
                        )
                        .map(
                          (
                            subStage: FetchedSubStage,
                            subStageIndex: number
                          ) => (
                            <div
                              key={subStage.id}
                              className="flex items-center justify-between"
                            >
                              <div>
                                <span>{`${displaySequenceOrder}.${subStage.sequence_order}. ${subStage.name}`}</span>
                                {subStage.location && (
                                  <p className="text-sm text-muted-foreground">
                                    Location: {subStage.location}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Move Sub-stage Up"
                                  onClick={() =>
                                    handleMoveSubStage(subStage.id, "up")
                                  }
                                  disabled={
                                    subStageIndex === 0 ||
                                    reorderStageMutation.isPending ||
                                    reorderSubStageMutation.isPending
                                  }
                                >
                                  <ArrowUpIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Move Sub-stage Down"
                                  onClick={() =>
                                    handleMoveSubStage(subStage.id, "down")
                                  }
                                  disabled={
                                    subStageIndex ===
                                      stage.sub_stages.length - 1 ||
                                    reorderStageMutation.isPending ||
                                    reorderSubStageMutation.isPending
                                  }
                                >
                                  <ArrowDownIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit Sub-stage"
                                  onClick={() => handleEditSubStage(subStage)}
                                  disabled={
                                    reorderStageMutation.isPending ||
                                    reorderSubStageMutation.isPending
                                  }
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  title="Delete Sub-stage"
                                  onClick={() => handleDeleteSubStage(subStage)}
                                  disabled={
                                    reorderStageMutation.isPending ||
                                    reorderSubStageMutation.isPending
                                  }
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  )}
                  {stage.sub_stages.length === 0 && (
                    <p className="ml-6 mt-2 text-sm text-muted-foreground">
                      No sub-stages defined for this stage. Sub-stages can only
                      be added during stage creation.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
    </>
  );
}
