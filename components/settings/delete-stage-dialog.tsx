// Create file: components/settings/delete-stage-dialog.tsx
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure"; // Assuming this helper exists
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure"; // Import the correct type
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow"; // Import sidebar key helper

interface DeleteStageDialogProps {
  organizationId: string;
  stage: FetchedWorkflowStage | null; // Use FetchedWorkflowStage
  isOpen: boolean;
  onClose: () => void;
}

async function deleteStageApi(stageId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/settings/workflow/stages/${stageId}`, {
    method: "DELETE",
  });
  const data = await response.json(); // Always try to parse JSON
  if (!response.ok) {
    // Use the error message from the API (e.g., "Cannot delete...items exist")
    throw new Error(
      data.error || `Failed to delete stage (${response.status})`
    );
  }
  return data;
}

export function DeleteStageDialog({
  organizationId,
  stage,
  isOpen,
  onClose,
}: DeleteStageDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    {
      message: string;
    },
    Error,
    string
  >({
    // <TData, TError, TVariables>
    // mutationFn now accepts the stageId as an argument
    mutationFn: (stageId: string) => {
      // No need to check stage?.id here, as we receive the ID directly
      return deleteStageApi(stageId);
    },
    onSuccess: () => {
      // We might not have the stage name easily accessible here anymore
      // Let's use a generic message or fetch it if needed, for now generic:
      toast.success(`Stage deleted successfully!`);
      // Invalidate structure query
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      // Invalidate sidebar query
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
      onClose(); // Close dialog on success
    },
    onError: (error) => {
      // Error message likely comes from the API check (e.g., 409 Conflict)
      toast.error(`${error.message}`);
      onClose(); // Close dialog even on error, as the action failed
    },
  });

  const handleDeleteConfirm = () => {
    // Ensure stage and stage.id exist before mutating
    if (stage?.id) {
      mutation.mutate(stage.id); // Pass stage.id directly
    } else {
      console.error(
        "[DeleteStageDialog] handleDeleteConfirm - Attempted delete without stage ID!"
      );
      toast.error("Cannot delete stage: Stage information is missing.");
      onClose(); // Close if something went wrong
    }
  };

  if (!stage) return null; // Don't render if no stage data

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the stage{" "}
            <strong>&quot;{stage.name}&quot;</strong>.
            <br />
            <span className="text-destructive font-semibold">
              Deletion will fail if any items are currently in this stage.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          {/* Use AlertDialogAction which styles itself like a primary button */}
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "Deleting..." : "Yes, Delete Stage"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
