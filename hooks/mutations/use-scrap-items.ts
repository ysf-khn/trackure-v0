import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Define the expected structure of the API response for success/partial success
type ScrapSuccessResponse = {
  message: string;
  results: {
    itemId: string;
    scrappedItemId: string | null; // null for total scraps (item deleted)
    replacementItemId: string | null;
    message: string;
  }[];
  errors?: { itemId: string; error: string; details?: string; code?: string }[];
};

// Define the structure for the API error response
type ScrapErrorResponse = {
  error: string;
  details?: unknown;
  type?: string;
};

// Define the type for the mutation variables
interface ScrapItemsVariables {
  items: {
    id: string;
    quantity: number;
    stage_id: string; // NEW: Which stage to scrap from
  }[];
  scrap_reason: string;
  create_replacement: boolean;
  preserve_total_quantity: boolean;
  organizationId: string; // Needed for query invalidation
}

async function scrapItemsAPI(
  variables: ScrapItemsVariables
): Promise<ScrapSuccessResponse> {
  const { organizationId, ...apiPayload } = variables; // Exclude orgId from API payload

  const response = await fetch("/api/items/scrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(apiPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ScrapErrorResponse;
    let errorMessage =
      errorData.error || `Failed to scrap items. Status: ${response.status}`;
    if (errorData.details) {
      // Attempt to stringify details for better error reporting
      try {
        const detailsString = JSON.stringify(errorData.details);
        errorMessage += ` (Details: ${detailsString})`;
      } catch (e) {
        errorMessage += " (Details could not be stringified)";
      }
    }
    throw new Error(errorMessage);
  }
  return data as ScrapSuccessResponse;
}

export function useScrapItems() {
  const queryClient = useQueryClient();

  return useMutation<ScrapSuccessResponse, Error, ScrapItemsVariables>({
    mutationFn: scrapItemsAPI,
    onSuccess: (data, variables) => {
      const { organizationId } = variables;

      console.log("[SCRAP CACHE DEBUG] Starting cache invalidation for org:", organizationId);

      // Use the same simple invalidation pattern that works for move forward/rework
      queryClient.invalidateQueries({
        queryKey: ["itemsInStage", organizationId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workflow", "sidebar"],
      });

      queryClient.invalidateQueries({
        queryKey: ["newItemsCount"],
      });

      queryClient.invalidateQueries({
        queryKey: ["completedItemsCount"],
      });

      queryClient.invalidateQueries({
        queryKey: ["stage-item-counts", organizationId],
      });

      console.log("[SCRAP CACHE DEBUG] Cache invalidation completed");

      // Handle partial success/errors from the API response
      if (data.errors && data.errors.length > 0) {
        // Show detailed error information for failed items
        const errorMessages = data.errors.map(e => 
          `${e.itemId}: ${e.error}${e.details ? ` (${e.details})` : ''}`
        ).join(", ");
        
        toast.warning(
          `Some items failed to scrap: ${errorMessages}`,
          { duration: 10000 }
        );
        console.warn("Scrap partial failures:", data.errors);
      } else {
        toast.success(data.message || "Items scrapped successfully!");
      }

      // Log successful results for debugging
      if (data.results && data.results.length > 0) {
        console.log("Scrap successful results:", data.results);
      }
    },
    onError: (error: Error) => {
      console.error("Scrap error:", error);
      toast.error(error.message || "An error occurred while scrapping items.");
    },
  });
}