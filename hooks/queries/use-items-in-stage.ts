import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
// import { useAuth } from "@/hooks/use-auth"; // Removed direct dependency

// Define the structure of the fetched item data including the entry time and history ID
export interface ItemInStage {
  id: string;
  sku: string;
  order_id: string;
  instance_details: Record<string, unknown>; // Use unknown for flexible JSON
  current_stage_id: string;
  current_sub_stage_id: string | null;
  current_stage_entered_at: string | null; // ISO timestamp for when the item entered the current stage
  current_stage_history_id: number | null; // ID of the item_history entry for entering the current stage
  quantity: number; // Add quantity field
  // Add other relevant item fields as needed
}

// Define the structure of the history entry subset we need
type HistoryMovementEntry = {
  id: number;
  moved_at: string;
  to_stage_id: string | null;
  to_sub_stage_id: string | null;
};

const fetchItemsInStage = async (
  organizationId: string,
  stageId: string,
  subStageId: string | null,
  orderIdFilter: string | null
): Promise<ItemInStage[]> => {
  const supabase = await createClient();

  let query = supabase
    .from("item_stage_allocations") // Query item_stage_allocations table
    .select(
      `
      stage_id,
      sub_stage_id,
      quantity, 
      items:items!inner (
        id,
        sku,
        order_id,
        instance_details,
        item_movement_history (
          id,
          moved_at,
          to_stage_id,
          to_sub_stage_id
        )
      )
    `
    )
    .eq("organization_id", organizationId) // Filter on item_stage_allocations
    .eq("stage_id", stageId); // Filter on item_stage_allocations

  if (subStageId) {
    query = query.eq("sub_stage_id", subStageId);
  } else {
    query = query.is("sub_stage_id", null);
  }

  // Filter by order_id from the joined items table
  if (orderIdFilter) {
    query = query.eq("items.order_id", orderIdFilter);
  }

  // It might be beneficial to order allocations, e.g., by their creation time
  query = query.order("created_at", { ascending: false });

  const { data: allocations, error } = await query;

  if (error) {
    console.error("Error fetching items in stage:", error);
    throw new Error(error.message);
  }

  const processedData =
    allocations
      ?.map((alloc) => {
        // Assuming alloc.items might be an array due to Supabase join behavior,
        // even with !inner, let's defensively access the first element.
        const itemDetails =
          Array.isArray(alloc.items) && alloc.items.length > 0
            ? alloc.items[0]
            : !Array.isArray(alloc.items)
              ? alloc.items
              : null;

        if (!itemDetails) {
          // This case should ideally not be hit if items!inner works as expected
          // or if the data integrity (FK) is guaranteed.
          console.warn(
            "Skipping allocation due to missing item details:",
            alloc
          );
          return null;
        }

        const movementEntries =
          (itemDetails.item_movement_history as HistoryMovementEntry[]) || [];

        const currentStageMovement = movementEntries
          .filter(
            (h) =>
              h.to_stage_id === alloc.stage_id && // Compare with alloc's stage_id
              h.to_sub_stage_id === alloc.sub_stage_id // Compare with alloc's sub_stage_id
          )
          .sort(
            (a, b) =>
              new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()
          );

        const latestEntryForCurrentStage = currentStageMovement[0] ?? null;

        return {
          id: itemDetails.id, // Item's actual ID from the items table
          sku: itemDetails.sku,
          order_id: itemDetails.order_id,
          instance_details: itemDetails.instance_details,
          current_stage_id: alloc.stage_id, // Stage from item_stage_allocations
          current_sub_stage_id: alloc.sub_stage_id, // Sub-stage from item_stage_allocations
          current_stage_entered_at:
            latestEntryForCurrentStage?.moved_at ?? null,
          current_stage_history_id: latestEntryForCurrentStage?.id ?? null,
          quantity: alloc.quantity, // Assign the fetched quantity
        };
      })
      // Filter out any nulls that might have occurred
      .filter(Boolean) || [];

  return processedData as ItemInStage[]; // Add type assertion back for safety
};

export const useItemsInStage = (
  organizationId: string | undefined | null,
  stageId: string,
  subStageId: string | null,
  orderIdFilter: string | null
) => {
  // const { organizationId } = useAuth(); // Removed direct call

  return useQuery<ItemInStage[], Error>({
    queryKey: [
      "itemsInStage",
      organizationId,
      stageId,
      subStageId,
      orderIdFilter,
    ],
    queryFn: () => {
      if (!organizationId || !stageId) {
        // Return an empty array or throw if prerequisites are not met
        return Promise.resolve([]);
      }
      return fetchItemsInStage(
        organizationId,
        stageId,
        subStageId,
        orderIdFilter
      );
    },
    // Query will only run if organizationId and stageId are truthy
    enabled: !!organizationId && !!stageId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
