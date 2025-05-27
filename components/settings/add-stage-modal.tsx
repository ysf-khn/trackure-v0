// Create file: components/settings/add-stage-modal.tsx
import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlusIcon, TrashIcon, InfoIcon } from "lucide-react";
import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure";
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow";

const subStageSchema = z.object({
  name: z.string().min(1, "Sub-stage name is required"),
  location: z.string().optional(),
});

const formSchema = z
  .object({
    name: z.string().min(1, "Stage name is required"),
    location: z.string().optional(),
    hasSubStages: z.boolean(),
    subStages: z.array(subStageSchema).optional(),
  })
  .refine(
    (data) => {
      // If hasSubStages is true, must have at least one sub-stage
      if (data.hasSubStages) {
        return data.subStages && data.subStages.length > 0;
      }
      return true;
    },
    {
      message: "At least one sub-stage is required when sub-stages are enabled",
      path: ["subStages"],
    }
  );

type FormData = z.infer<typeof formSchema>;

interface AddStageModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CreatedStageResponse {
  id: string;
  name: string;
}

async function createStageWithSubStages(
  values: FormData
): Promise<CreatedStageResponse> {
  const response = await fetch(`/api/settings/workflow/stages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || "Failed to create stage");
  }
  return response.json();
}

export function AddStageModal({
  organizationId,
  isOpen,
  onClose,
}: AddStageModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      hasSubStages: false,
      subStages: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subStages",
  });

  const hasSubStages = form.watch("hasSubStages");

  const mutation = useMutation<CreatedStageResponse, Error, FormData>({
    mutationFn: createStageWithSubStages,
    onSuccess: (data) => {
      toast.success(`Stage "${data.name}" created successfully!`);
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId),
      });
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
    // Clean up data before submission
    const submitData = {
      ...values,
      subStages: values.hasSubStages ? values.subStages : undefined,
    };
    mutation.mutate(submitData);
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    form.reset();
    onClose();
  };

  const addSubStage = () => {
    append({ name: "", location: "" });
  };

  const removeSubStage = (index: number) => {
    remove(index);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Workflow Stage</DialogTitle>
          <DialogDescription>
            Create a new stage in your workflow. You can optionally add
            sub-stages during creation.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Sub-stages can only be added during
            stage creation. Once a stage is created, you cannot convert it to
            have sub-stages later. If a stage has sub-stages, items can only be
            moved to the sub-stages, not the parent stage.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Stage Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stage Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter stage name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter location" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasSubStages"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Enable Sub-stages</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Check this if you want to add sub-stages to this
                          stage. Sub-stages allow for more granular workflow
                          control.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Sub-stages Section */}
            {hasSubStages && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Sub-stages
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSubStage}
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Sub-stage
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No sub-stages added yet. Click "Add Sub-stage" to get
                      started.
                    </p>
                  )}

                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-4 items-end">
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`subStages.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sub-stage Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter sub-stage name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`subStages.${index}.location`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter location"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeSubStage(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {hasSubStages && fields.length === 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        At least one sub-stage is required when sub-stages are
                        enabled.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

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
                {mutation.isPending ? "Creating..." : "Create Stage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
