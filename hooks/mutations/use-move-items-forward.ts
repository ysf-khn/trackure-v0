import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner"; // Or your preferred toast library

// Define the expected structure of the API response for success/partial success
type MoveForwardSuccessResponse = {
  message: string;
  results: {
    itemId: string;
    status: "success";
    nextStageId: string;
    nextSubStageId: string | null;
  }[];
  errors?: { itemId: string; error: string }[];
};

// Define the structure for the API error response
type MoveForwardErrorResponse = {
  error: string;
  details?: unknown; // Use unknown instead of any for better type safety
};

// Define the type for the mutation variables
interface MoveItemsForwardVariables {
  items: { id: string; quantity: number }[]; // Updated from itemIds
  organizationId: string;
  targetStageId?: string | null; // Add optional target stage ID
  targetSubStageId?: string | null; // Add optional target sub-stage ID
  sourceStageId?: string | null; // Add optional source stage ID
}

async function moveItemsForwardAPI(
  variables: MoveItemsForwardVariables
): Promise<MoveForwardSuccessResponse> {
  // Construct the body, including target_stage_id, target_sub_stage_id and source_stage_id if present
  const body: {
    items: { id: string; quantity: number }[];
    target_stage_id?: string | null;
    target_sub_stage_id?: string | null;
    source_stage_id?: string | null;
  } = {
    // Updated property name
    items: variables.items, // Use the new items array
  };
  if (variables.targetStageId !== undefined) {
    body.target_stage_id = variables.targetStageId;
  }
  if (variables.targetSubStageId !== undefined) {
    body.target_sub_stage_id = variables.targetSubStageId;
  }
  if (variables.sourceStageId !== undefined) {
    body.source_stage_id = variables.sourceStageId;
  }

  const response = await fetch("/api/items/move/forward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body), // Send the constructed body
  });

  const data = await response.json();

  if (!response.ok) {
    // Try to parse the error message from the response
    // const errorData = data as MoveForwardErrorResponse;
    // throw new Error(
    //   errorData.error || `Failed to move items. Status: ${response.status}`
    // );
    let errorMessage = `Failed to move items. Status: ${response.status}`;
    if (data) {
      if (data.error && typeof data.error === "string") {
        // Case 1: Standard error message from API { error: "..." }
        errorMessage = data.error;
      } else if (data.message && typeof data.message === "string") {
        // Case 2: API returns a message, possibly with an array of errors
        // (e.g., when all items fail processing in the move/forward route)
        errorMessage = data.message;
        if (
          data.errors &&
          Array.isArray(data.errors) &&
          data.errors.length > 0
        ) {
          const firstDetail = data.errors[0];
          if (firstDetail && typeof firstDetail.error === "string") {
            errorMessage += ` (Details: ${firstDetail.error})`;
          } else if (firstDetail && typeof firstDetail.itemId === "string") {
            errorMessage += ` (First item affected: ${firstDetail.itemId})`;
          }
        }
      } else if (typeof data === "string") {
        // Case 3: API returns a plain string error
        errorMessage = data;
      }
    }
    throw new Error(errorMessage);
  }

  return data as MoveForwardSuccessResponse;
}

export function useMoveItemsForward() {
  const queryClient = useQueryClient();

  return useMutation<
    MoveForwardSuccessResponse,
    Error,
    MoveItemsForwardVariables // Use the new variables type
  >({
    // Pass the whole variables object to the API function
    mutationFn: (variables) => moveItemsForwardAPI(variables),
    onSuccess: (data, variables) => {
      // 'variables' contains { itemIds, organizationId, targetStageId }
      // toast.success(data.message || "Items moved forward successfully!");

      const { organizationId } = variables; // Get organizationId from variables

      // Invalidate queries using the organizationId AND the general workflow structure
      // 1. Invalidate all stages for the current org (for table views)
      queryClient.invalidateQueries({
        queryKey: ["itemsInStage", organizationId],
      });

      // 2. Invalidate the workflow sidebar query (which includes counts for the sidebar)
      queryClient.invalidateQueries({
        queryKey: ["workflow", "sidebar"],
      });

      // 3. Invalidate the new items count query
      queryClient.invalidateQueries({
        queryKey: ["newItemsCount"],
      });

      // 4. Invalidate the completed items count query
      queryClient.invalidateQueries({
        queryKey: ["completedItemsCount"],
      });

      // Optional: More precise invalidation if needed later
      // You could iterate through data.results and invalidate specific
      // destination stages: ['itemsInStage', organizationId, result.nextStageId, result.nextSubStageId]
      // Invalidating the source stage requires passing its ID to the mutation as well.

      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Some items failed to move: ${data.errors
            .map((e) => e.itemId)
            .join(", ")}`
        );
        console.warn("Move forward partial failures:", data.errors);
      }
    },
    onError: (error) => {
      console.error("Move forward error:", error);
      toast.error(error.message || "An error occurred while moving items.");
    },
  });
}
