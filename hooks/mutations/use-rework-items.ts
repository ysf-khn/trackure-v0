import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Define the expected structure of the API response for success/partial success
type ReworkSuccessResponse = {
  message: string;
  results: {
    itemId: string;
    status: "success";
    reworkedToStageId: string;
    reworkedToSubStageId: string | null;
    quantity: number;
  }[];
  errors?: { itemId: string; error: string }[];
};

// Define the structure for the API error response
type ReworkErrorResponse = {
  error: string;
  details?: unknown;
};

// Define the type for the mutation variables
interface ReworkItemsVariables {
  items: {
    id: string;
    quantity: number;
    source_stage_id: string;
    source_sub_stage_id: string | null;
  }[];
  rework_reason: string;
  target_rework_stage_id: string;
  organizationId: string; // Needed for query invalidation
}

async function reworkItemsAPI(
  variables: ReworkItemsVariables
): Promise<ReworkSuccessResponse> {
  const { organizationId, ...apiPayload } = variables; // Exclude orgId from API payload if not needed by API directly

  const response = await fetch("/api/items/move/rework", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(apiPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ReworkErrorResponse;
    let errorMessage =
      errorData.error || `Failed to rework items. Status: ${response.status}`;
    if (errorData.details) {
      // Attempt to stringify details, as it can be complex (ZodError.format())
      try {
        const detailsString = JSON.stringify(errorData.details);
        errorMessage += ` (Details: ${detailsString})`;
      } catch (e) {
        errorMessage += " (Details could not be stringified)";
      }
    }
    throw new Error(errorMessage);
  }
  return data as ReworkSuccessResponse;
}

export function useReworkItems() {
  const queryClient = useQueryClient();

  return useMutation<ReworkSuccessResponse, Error, ReworkItemsVariables>({
    mutationFn: reworkItemsAPI,
    onSuccess: (data, variables) => {
      const { organizationId } = variables;

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["itemsInStage", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workflow", "structure"],
      });
      queryClient.invalidateQueries({
        queryKey: ["sidebar-counts", organizationId],
      });

      // Handle partial success/errors from the API response
      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Some items failed to rework: ${data.errors
            .map((e) => `${e.itemId} (${e.error})`)
            .join(", ")}`,
          { duration: 8000 }
        );
        console.warn("Rework partial failures:", data.errors);
      } else {
        toast.success(data.message || "Items reworked successfully!");
      }

      // Further actions like closing a modal should be handled in the component calling the mutation
    },
    onError: (error: Error) => {
      console.error("Rework error:", error);
      toast.error(error.message || "An error occurred while reworking items.");
    },
  });
}
