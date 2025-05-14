// Create file: components/settings/add-stage-modal.tsx
import React from "react";
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
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow"; // Import sidebar key helper

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().optional(), // Optional location field
});

type FormData = z.infer<typeof formSchema>;

interface AddStageModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Define a more specific return type (adjust based on actual API response)
interface CreatedStageResponse {
  id: string;
  name: string;
  // Add other relevant fields if returned by API
}

async function createStage(
  values: FormData
  // organizationId: string // Removed unused parameter
): Promise<CreatedStageResponse> {
  // Updated return type
  const response = await fetch(`/api/settings/workflow/stages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    // Parse error *before* throwing
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || "Failed to create stage");
  }
  return response.json(); // Return parsed JSON
}

export function AddStageModal({
  organizationId, // Keep orgId here, needed for invalidation
  isOpen,
  onClose,
}: AddStageModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const mutation = useMutation<CreatedStageResponse, Error, FormData>({
    mutationFn: (values: FormData) => createStage(values), // Pass only values
    onSuccess: (data) => {
      toast.success(`Stage "${data.name}" created successfully!`);
      // Invalidate structure query
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
      // Invalidate sidebar query
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast.error(`Error creating stage: ${error.message}`);
    },
  });

  const onSubmit = (values: FormData) => {
    mutation.mutate(values);
  };

  const handleClose = () => {
    if (mutation.isPending) return; // Prevent closing while submitting
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Workflow Stage</DialogTitle>
          <DialogDescription>
            Enter the name for the new stage. The sequence order will be
            automatically assigned.
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
                {mutation.isPending ? "Adding..." : "Add Stage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
