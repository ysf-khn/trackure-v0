"use client";

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
import { Loader2 } from "lucide-react";
import {
  type FetchedSubStage,
  getWorkflowQueryKey,
} from "@/hooks/queries/use-workflow-structure";
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow";

// Define a custom error type to mimic AxiosError structure for easier migration
interface ApiErrorData {
  error: string;
}

interface ApiError extends Error {
  response?: {
    data: ApiErrorData;
    status: number;
  };
}

interface DeleteSubStageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  subStage: FetchedSubStage | null; // Use FetchedSubStage
}

export function DeleteSubStageDialog({
  isOpen,
  onClose,
  organizationId,
  subStage,
}: DeleteSubStageDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void, // Success type (204 No Content)
    ApiError, // Error type changed from AxiosError
    string // Variables type (subStageId)
  >({
    mutationFn: async (subStageId) => {
      const response = await fetch(
        `/api/settings/workflow/sub-stages/${subStageId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData: ApiErrorData = await response.json().catch(() => ({
          error: "Failed to parse error response.",
        }));
        const error: ApiError = new Error(
          errorData.error || "API request failed"
        );
        error.response = { data: errorData, status: response.status };
        throw error;
      }
      // DELETE typically returns 204 No Content, so no body to parse
    },
    onSuccess: () => {
      toast.success(
        `Sub-stage "${subStage?.name ?? "Sub-stage"}" deleted successfully.`
      );
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
      onClose();
    },
    onError: (error) => {
      // Handle specific 409 Conflict error
      let description =
        error.message || "Failed to delete sub-stage. Please try again.";
      if (error.response?.status === 409 && error.response?.data?.error) {
        description = error.response.data.error; // Use the specific message from API
      } else if (error.response?.data?.error) {
        description = error.response.data.error;
      }

      toast.error("Error Deleting Sub-Stage", { description: description });
      // Do not close dialog on error, let user cancel manually
    },
  });

  const handleDeleteConfirm = () => {
    if (!subStage?.id) {
      toast.error("Error", { description: "Sub-stage ID is missing." });
      return;
    }
    mutation.mutate(subStage.id);
  };

  // Prevent closing via overlay click or escape key while mutating
  const handleOpenChange = (open: boolean) => {
    if (!mutation.isPending && !open) {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen && !!subStage} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            sub-stage &ldquo;
            <strong>{subStage?.name ?? "this sub-stage"}</strong>&rdquo;. You
            can only delete a sub-stage if no items are currently assigned to
            it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Sub-Stage
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
