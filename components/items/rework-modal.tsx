"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error display
import { AlertTriangle } from "lucide-react"; // Using Lucide icon
import { Spinner } from "../ui/spinner";

// --- Types ---
// Type for the data returned by the valid rework targets API
export interface ReworkTarget {
  id: string;
  name: string;
  type: "stage" | "sub_stage";
  parent_stage_id?: string | null;
  sequence_order: number; // Added sequence_order from updated API
}

// Zod schema for the form
const reworkFormSchema = z.object({
  target: z.string({
    required_error: "Please select a target stage or sub-stage.",
  }), // Holds combined "type:id"
  reason: z
    .string()
    .trim()
    .min(1, { message: "Please provide a reason for the rework." })
    .max(500, { message: "Reason cannot exceed 500 characters." }),
});

type ReworkFormValues = z.infer<typeof reworkFormSchema>;

export interface ReworkModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: {
    id: string;
    current_stage_id: string;
    current_sub_stage_id?: string | null;
    display_name?: string;
  }[]; // Pass selected items with stage info
  onSuccess?: () => void; // Optional callback on successful rework
}

// --- API Helper Functions ---

// Function to fetch valid rework targets
const fetchValidReworkTargets = async (
  currentItemStageId: string,
  currentItemSubStageId?: string | null
): Promise<ReworkTarget[]> => {
  let url = `/api/workflows/valid-rework-targets?currentItemStageId=${currentItemStageId}`;
  if (currentItemSubStageId) {
    url += `&currentItemSubStageId=${currentItemSubStageId}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // Try to parse error json
    throw new Error(errorData.error || "Failed to fetch rework targets");
  }
  const targets: ReworkTarget[] = await response.json();
  // Optionally sort client-side if API doesn't guarantee order (though the example SQL does)
  // targets.sort((a, b) => a.sequence_order - b.sequence_order);
  return targets;
};

// Function to call the rework API
const postReworkAction = async (data: {
  item_ids: string[];
  rework_stage_id: string;
  rework_sub_stage_id: string | null;
  rework_reason: string;
}): Promise<{ success: boolean; message?: string }> => {
  const response = await fetch("/api/items/move/rework", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Use a more specific error message if available from the API
    throw new Error(errorData.error || "Failed to process rework action");
  }
  return response.json(); // Contains { success: true, message: "..." }
};

// --- Component ---
export function ReworkModal({
  isOpen,
  onOpenChange,
  items = [], // Default to empty array
  onSuccess,
}: ReworkModalProps) {
  const queryClient = useQueryClient();

  // Determine the common current stage/sub-stage for the selected items
  // This assumes rework is only allowed if all selected items are in the same stage/sub-stage.
  // Adjust logic if rework across different stages is permitted.
  const commonStageId =
    items.length > 0 ? items[0].current_stage_id : undefined;
  const commonSubStageId =
    items.length > 0 ? items[0].current_sub_stage_id : undefined;
  const areItemsInConsistentState = items.every(
    (item) =>
      item.current_stage_id === commonStageId &&
      item.current_sub_stage_id === commonSubStageId
  );

  const form = useForm<ReworkFormValues>({
    resolver: zodResolver(reworkFormSchema),
    defaultValues: {
      target: "",
      reason: "",
    },
  });

  // Fetch valid rework targets based on the common stage/sub-stage
  const {
    data: reworkTargets,
    isLoading: isLoadingTargets,
    error: targetsError,
    refetch: refetchTargets, // Function to manually refetch
  } = useQuery<ReworkTarget[], Error>({
    queryKey: ["reworkTargets", commonStageId, commonSubStageId],
    queryFn: () => {
      if (!commonStageId) {
        // Should not happen if modal is opened correctly, but prevents fetch with undefined ID
        return Promise.resolve([]);
      }
      return fetchValidReworkTargets(commonStageId, commonSubStageId);
    },
    enabled: isOpen && !!commonStageId && areItemsInConsistentState, // Only fetch when modal is open, has items in a consistent state
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Mutation for submitting the rework action
  const {
    mutate: submitRework,
    isPending: isSubmitting,
    error: submitError,
  } = useMutation<
    { success: boolean; message?: string }, // Expected success data type
    Error, // Error type
    ReworkFormValues // Variables type
  >({
    mutationFn: async (formData) => {
      if (!reworkTargets) {
        throw new Error("Target data is not available.");
      }

      const [type, id] = formData.target.split(":");
      const isSubStage = type === "sub_stage";
      const targetData = reworkTargets.find(
        (t) => t.id === id && t.type === type
      );

      if (!targetData) {
        throw new Error("Invalid target selected.");
      }

      const itemIds = items.map((item) => item.id);

      return postReworkAction({
        item_ids: itemIds,
        rework_stage_id: isSubStage ? (targetData.parent_stage_id ?? "") : id, // Find parent stage ID if target is sub-stage
        rework_sub_stage_id: isSubStage ? id : null,
        rework_reason: formData.reason,
      });
    },
    onSuccess: (data) => {
      toast.success(
        data?.message ||
          `${items.length} item(s) sent back for rework successfully.`
      );
      // Invalidate relevant queries to trigger UI updates
      queryClient.invalidateQueries({ queryKey: ["items"] }); // Adjust query key as needed for item tables
      queryClient.invalidateQueries({ queryKey: ["itemHistory"] }); // Invalidate history if displayed
      queryClient.invalidateQueries({ queryKey: ["workflow", "structure"] }); // Correct key for sidebar counts
      form.reset();
      onOpenChange(false);
      onSuccess?.(); // Call optional success callback provided by parent
    },
    onError: (error) => {
      // Error is handled by the submitError state and Alert component below
      console.error("Rework submission error:", error);
      // Optionally show a generic toast, but the Alert provides more context
      // toast.error(error.message || "An unexpected error occurred during submission.");
    },
  });

  const onSubmit = (data: ReworkFormValues) => {
    if (!areItemsInConsistentState) {
      toast.error(
        "Cannot rework items from different stages/sub-stages simultaneously."
      );
      return;
    }
    submitRework(data);
  };

  // Handle closing the modal - reset form state and potentially query state
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      // Consider resetting or removing the query cache if targets shouldn't persist across modal openings
      // queryClient.removeQueries({ queryKey: ['reworkTargets', commonStageId, commonSubStageId] });
    }
    onOpenChange(open);
  };

  // Effect to refetch targets if the selected items change while the modal is open
  React.useEffect(() => {
    if (isOpen && commonStageId && areItemsInConsistentState) {
      refetchTargets();
    }
  }, [isOpen, items, areItemsInConsistentState, commonStageId, refetchTargets]);

  const itemsToDisplay = items.slice(0, 3); // Show first few item names/IDs
  const additionalItemsCount = items.length - itemsToDisplay.length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Send Item(s) Back for Rework</DialogTitle>
          <DialogDescription>
            Selected items:{" "}
            {itemsToDisplay
              .map((item) => item.display_name || item.id)
              .join(", ")}
            {additionalItemsCount > 0 && ` and ${additionalItemsCount} more.`}
            <br />
            Select the previous step to return these item(s) to and provide a
            reason.
          </DialogDescription>
        </DialogHeader>

        {!areItemsInConsistentState && isOpen && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inconsistent Selection</AlertTitle>
            <AlertDescription>
              Items must be in the same stage and sub-stage to be sent back
              together. Please adjust your selection.
            </AlertDescription>
          </Alert>
        )}

        {targetsError && areItemsInConsistentState && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Targets</AlertTitle>
            <AlertDescription>
              {targetsError.message ||
                "Could not load previous stages. Please try again later."}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="target"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Rework Step</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value} // Use value prop for controlled component
                    disabled={
                      isLoadingTargets ||
                      isSubmitting ||
                      !reworkTargets ||
                      reworkTargets.length === 0 ||
                      !areItemsInConsistentState
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingTargets
                              ? "Loading targets..."
                              : areItemsInConsistentState
                                ? "Select target..."
                                : "Select items in same stage..."
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingTargets && (
                        <SelectItem value="loading" disabled>
                          Loading...
                        </SelectItem>
                      )}
                      {!isLoadingTargets &&
                        areItemsInConsistentState &&
                        (!reworkTargets || reworkTargets.length === 0) && (
                          <SelectItem value="no-targets" disabled>
                            {targetsError
                              ? "Error loading targets"
                              : "No valid previous steps found"}
                          </SelectItem>
                        )}
                      {reworkTargets?.map((target) => (
                        <SelectItem
                          key={`${target.type}:${target.id}`}
                          value={`${target.type}:${target.id}`}
                        >
                          {/* Indent sub-stages visually */}
                          {target.type === "sub_stage" && (
                            <span className="ml-4">↳ </span>
                          )}
                          {target.name}
                          {/* <span className="text-muted-foreground text-xs ml-2">({target.type})</span> */}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the step the item(s) should return to.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Rework</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why the item(s) are being sent back..."
                      className="resize-none"
                      rows={4}
                      {...field}
                      disabled={isSubmitting || !areItemsInConsistentState}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Submission Failed</AlertTitle>
                <AlertDescription>
                  {/* Display the specific error from the API if available */}
                  {submitError.message ||
                    "An unexpected error occurred. Please try again."}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoadingTargets ||
                  !form.formState.isValid ||
                  !reworkTargets ||
                  reworkTargets.length === 0 ||
                  !areItemsInConsistentState
                }
              >
                {isSubmitting && (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Back for Rework
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
