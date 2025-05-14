// Create file: components/settings/edit-stage-modal.tsx
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure"; // Assuming this helper exists
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure"; // Import the correct type
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow"; // Import sidebar key helper

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().optional(), // Optional location field
});

type FormData = z.infer<typeof formSchema>;

interface EditStageModalProps {
  organizationId: string;
  stage: FetchedWorkflowStage | null; // Use FetchedWorkflowStage
  isOpen: boolean;
  onClose: () => void;
}

async function updateStage(
  stageId: string,
  values: FormData
): Promise<FetchedWorkflowStage> {
  // Expect API to return FetchedWorkflowStage or compatible
  const response = await fetch(`/api/settings/workflow/stages/${stageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update stage");
  }
  return response.json();
}

export function EditStageModal({
  organizationId,
  stage,
  isOpen,
  onClose,
}: EditStageModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: stage?.name || "", // Add fallback for null
      location: stage?.location || "", // Add fallback for null
    },
  });

  // Reset form when stage data changes (e.g., opening modal for a different stage)
  useEffect(() => {
    if (stage) {
      form.reset({ name: stage.name || "", location: stage.location || "" }); // Add fallback for null
    } else {
      form.reset({ name: "", location: "" });
    }
  }, [stage, form]);

  const mutation = useMutation({
    mutationFn: (values: FormData) => {
      if (!stage?.id) throw new Error("Stage ID is missing");
      return updateStage(stage.id, values);
    },
    onSuccess: (data) => {
      toast.success(`Stage renamed to "${data.name}" successfully!`);
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
      onClose(); // Close modal on success
    },
    onError: (error) => {
      toast.error(`Error updating stage: ${error.message}`);
    },
  });

  const onSubmit = (values: FormData) => {
    mutation.mutate(values);
  };

  const handleClose = () => {
    if (mutation.isPending) return; // Prevent closing while submitting
    onClose(); // Resetting form handled by useEffect or next open
  };

  if (!stage) return null; // Don't render if no stage data

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Stage Name</DialogTitle>
          <DialogDescription>
            Update the name for the stage &quot;{stage.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              <div>
                <FormLabel htmlFor="name">Stage Name</FormLabel>
                <FormControl>
                  <Input
                    id="name"
                    placeholder="Enter stage name"
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
