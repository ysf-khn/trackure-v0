"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { invalidateAllItemRelatedQueries } from "@/lib/cache-invalidation";

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
import { AlertTriangle, Trash2 } from "lucide-react"; // Using Lucide icon
import { Spinner } from "../ui/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
  action: z.enum(["rework", "scrap_and_replace", "scrap_totally"], {
    required_error: "Please select an action.",
  }),
  target: z.string().optional(), // Only required for rework
  reason: z
    .string()
    .trim()
    .min(1, { message: "Please provide a reason." })
    .max(500, { message: "Reason cannot exceed 500 characters." }),
}).refine((data) => {
  if (data.action === "rework" && !data.target) {
    return false;
  }
  return true;
}, {
  message: "Target stage is required for rework action.",
  path: ["target"],
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

// Function to call the scrap API
const postScrapAction = async (data: {
  item_ids: string[];
  scrap_reason: string;
  create_replacement: boolean;
}): Promise<{ success: boolean; message?: string }> => {
  // Transform the data to match the existing API format
  const apiData = {
    items: data.item_ids.map(id => ({
      id,
      quantity: 1, // Assuming 1 item per ID for simplicity
    })),
    scrap_reason: data.scrap_reason,
    create_replacement: data.create_replacement,
    preserve_total_quantity: true,
  };

  const response = await fetch("/api/items/scrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(apiData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to process scrap action");
  }
  
  const result = await response.json();
  return {
    success: true,
    message: result.message,
  };
};

// --- Component ---
export function ReworkModal({
  isOpen,
  onOpenChange,
  items = [], // Default to empty array
  onSuccess,
}: ReworkModalProps) {
  const queryClient = useQueryClient();
  const { profile } = useProfileAndOrg();
  const organizationId = profile?.organization_id || null;

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
      action: "rework",
      target: "",
      reason: "",
    },
  });

  const watchAction = form.watch("action");

  // Fetch valid rework targets based on the common stage/sub-stage (only for rework action)
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
    enabled: isOpen && !!commonStageId && areItemsInConsistentState && watchAction === "rework", // Only fetch when rework is selected
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Mutation for submitting the action (rework or scrap)
  const {
    mutate: submitAction,
    isPending: isSubmitting,
    error: submitError,
  } = useMutation<
    { success: boolean; message?: string }, // Expected success data type
    Error, // Error type
    ReworkFormValues // Variables type
  >({
    mutationFn: async (formData) => {
      const itemIds = items.map((item) => item.id);

      if (formData.action === "scrap_and_replace" || formData.action === "scrap_totally") {
        return postScrapAction({
          item_ids: itemIds,
          scrap_reason: formData.reason,
          create_replacement: formData.action === "scrap_and_replace",
        });
      } else {
        // Rework action
        if (!reworkTargets || !formData.target) {
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

        return postReworkAction({
          item_ids: itemIds,
          rework_stage_id: isSubStage ? (targetData.parent_stage_id ?? "") : id,
          rework_sub_stage_id: isSubStage ? id : null,
          rework_reason: formData.reason,
        });
      }
    },
    onSuccess: (data, variables) => {
      let actionText = "sent back for rework";
      if (variables.action === "scrap_and_replace") {
        actionText = "scrapped and replaced";
      } else if (variables.action === "scrap_totally") {
        actionText = "scrapped completely";
      }
      
      toast.success(
        data?.message ||
          `${items.length} item(s) ${actionText} successfully.`
      );
      // Invalidate relevant queries to trigger UI updates
      queryClient.invalidateQueries({ queryKey: ["items"] }); // Adjust query key as needed for item tables
      queryClient.invalidateQueries({ queryKey: ["itemHistory"] }); // Invalidate history if displayed

      // Use centralized cache invalidation for consistency
      invalidateAllItemRelatedQueries(queryClient, organizationId);
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
    submitAction(data);
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
    if (isOpen && commonStageId && areItemsInConsistentState && watchAction === "rework") {
      refetchTargets();
    }
  }, [isOpen, items, areItemsInConsistentState, commonStageId, refetchTargets, watchAction]);

  const itemsToDisplay = items.slice(0, 3); // Show first few item names/IDs
  const additionalItemsCount = items.length - itemsToDisplay.length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rework or Scrap Item(s)</DialogTitle>
          <DialogDescription>
            Selected items:{" "}
            {itemsToDisplay
              .map((item) => item.display_name || item.id)
              .join(", ")}
            {additionalItemsCount > 0 && ` and ${additionalItemsCount} more.`}
            <br />
            Choose to send items back for rework or scrap them completely.
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
              name="action"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Action</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="rework"
                          name="action"
                          value="rework"
                          checked={field.value === "rework"}
                          onChange={() => field.onChange("rework")}
                          disabled={isSubmitting || !areItemsInConsistentState}
                        />
                        <label htmlFor="rework" className="flex items-center gap-2 cursor-pointer">
                          Send Back for Rework
                          <span className="text-sm text-muted-foreground">
                            (Move to previous stage)
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="scrap_and_replace"
                          name="action"
                          value="scrap_and_replace"
                          checked={field.value === "scrap_and_replace"}
                          onChange={() => field.onChange("scrap_and_replace")}
                          disabled={isSubmitting || !areItemsInConsistentState}
                        />
                        <label htmlFor="scrap_and_replace" className="flex items-center gap-2 cursor-pointer">
                          <Trash2 className="h-4 w-4 text-orange-500" />
                          Scrap & Replace
                          <span className="text-sm text-muted-foreground">
                            (Create new items to replace scrapped ones)
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="scrap_totally"
                          name="action"
                          value="scrap_totally"
                          checked={field.value === "scrap_totally"}
                          onChange={() => field.onChange("scrap_totally")}
                          disabled={isSubmitting || !areItemsInConsistentState}
                        />
                        <label htmlFor="scrap_totally" className="flex items-center gap-2 cursor-pointer">
                          <Trash2 className="h-4 w-4 text-red-500" />
                          Scrap Completely
                          <span className="text-sm text-muted-foreground">
                            (Remove from production permanently)
                          </span>
                        </label>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchAction === "rework" && (
              <FormField
                control={form.control}
                name="target"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Rework Step</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""} // Use value prop for controlled component
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
            )}


            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {watchAction === "scrap_and_replace" || watchAction === "scrap_totally" ? "Reason for Scrapping" : "Reason for Rework"}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        watchAction === "scrap_and_replace" || watchAction === "scrap_totally"
                          ? "Explain why the item(s) are being scrapped..."
                          : "Explain why the item(s) are being sent back..."
                      }
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
                variant={watchAction === "scrap_and_replace" || watchAction === "scrap_totally" ? "destructive" : "default"}
                disabled={
                  isSubmitting ||
                  (watchAction === "rework" && (isLoadingTargets || !reworkTargets || reworkTargets.length === 0)) ||
                  !form.formState.isValid ||
                  !areItemsInConsistentState
                }
              >
                {isSubmitting && (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                {watchAction === "scrap_and_replace" || watchAction === "scrap_totally" ? (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {watchAction === "scrap_and_replace" ? "Scrap & Replace" : "Scrap Completely"}
                  </>
                ) : (
                  "Send Back for Rework"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
