"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  type FetchedSubStage,
  getWorkflowQueryKey,
} from "@/hooks/queries/use-workflow-structure";
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow";

// Define a custom error type to mimic AxiosError structure for easier migration
interface ApiErrorData {
  error: string | { _errors: string[] };
}

interface ApiError extends Error {
  response?: {
    data: ApiErrorData;
    status: number;
  };
}

// Schema matching the backend API (only name is updatable here)
const editSubStageSchema = z.object({
  name: z.string().min(1, { message: "Sub-stage name cannot be empty." }),
  location: z.string().optional(),
});

type EditSubStageFormData = z.infer<typeof editSubStageSchema>;

interface EditSubStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  subStage: FetchedSubStage | null; // Use FetchedSubStage
}

export function EditSubStageModal({
  isOpen,
  onClose,
  organizationId,
  subStage,
}: EditSubStageModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditSubStageFormData>({
    resolver: zodResolver(editSubStageSchema),
    defaultValues: {
      name: subStage?.name || "",
      location: subStage?.location || "",
    },
  });

  // Reset form when modal opens with a new subStage
  useEffect(() => {
    if (isOpen && subStage) {
      form.reset({
        name: subStage.name || "",
        location: subStage.location || "",
      });
    } else if (!isOpen) {
      // Clear form on close
      form.reset({ name: "", location: "" });
    }
  }, [isOpen, subStage, form]);

  const mutation = useMutation<
    FetchedSubStage, // Success type (API returns updated sub-stage)
    ApiError, // Error type changed from AxiosError
    EditSubStageFormData // Variables type
  >({
    mutationFn: async (updatedData) => {
      if (!subStage?.id) throw new Error("Sub-stage ID is missing.");
      const response = await fetch(
        `/api/settings/workflow/sub-stages/${subStage.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedData),
        }
      );

      if (!response.ok) {
        const errorData: ApiErrorData = await response.json().catch(() => ({
          error: "Failed to parse error response.",
        }));
        const error: ApiError = new Error(
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.error?._errors?.join(", ") || "API request failed"
        );
        error.response = { data: errorData, status: response.status };
        throw error;
      }
      return response.json() as Promise<FetchedSubStage>; // Return data on success
    },
    onSuccess: (data) => {
      toast.success(`Sub-stage "${data.name}" updated successfully.`);
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
      onClose();
    },
    onError: (error) => {
      const errorMsg =
        typeof error.response?.data.error === "string"
          ? error.response.data.error
          : typeof error.response?.data.error?._errors?.join(", ") === "string"
            ? error.response.data.error._errors.join(", ")
            : error.message || "Failed to update sub-stage. Please try again.";
      toast.error("Error Updating Sub-Stage", { description: errorMsg });
    },
  });

  const onSubmit = (data: EditSubStageFormData) => {
    if (!subStage) return; // Should not happen if modal is open
    mutation.mutate(data);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
    // Allow opening even if subStage is null initially, useEffect handles reset
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Sub-Stage</DialogTitle>
        </DialogHeader>
        {subStage ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <FormLabel htmlFor="name">Sub-Stage Name</FormLabel>
                  <FormControl>
                    <Input
                      id="name"
                      placeholder="Enter sub-stage name"
                      {...form.register("name")}
                    />
                  </FormControl>
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <FormLabel htmlFor="location">Location (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      id="location"
                      placeholder="Enter location"
                      {...form.register("location")}
                    />
                  </FormControl>
                  {form.formState.errors.location && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.location.message}
                    </p>
                  )}
                </div>
              </div>
              {/* Sequence order is not editable here, handled by reordering */}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          // Render loading or placeholder if subStage is null when opening
          <p>Loading sub-stage data...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
