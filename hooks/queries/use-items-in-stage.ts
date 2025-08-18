import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
// import { useAuth } from "@/hooks/use-auth"; // Removed direct dependency

interface HistoryMovementEntry {
  id: number;
  moved_at: string;
  from_stage_id: string | null;
  to_stage_id: string;
  quantity: number | null; // Make quantity optional to handle older records
  rework_type: string | null;
  rework_reason: string | null;
}

interface ItemDetails {
  id: string;
  sku: string;
  order_id: string;
  composite_group_id?: string | null;
  parent_composite_sku?: string | null;
  is_replacement?: boolean;
  replaced_item_id?: string | null;
  orders: {
    order_number: string | null;
  };
  instance_details: Record<string, unknown>;
  item_movement_history: HistoryMovementEntry[];
}

interface ItemAllocation {
  stage_id: string;
  quantity: number;
  allocation_type: string;
  items: ItemDetails | ItemDetails[];
}

export interface ItemInStage {
  id: string;
  sku: string;
  order_id: string;
  order_number: string | null;
  instance_details: Record<string, unknown>; // Use unknown for flexible JSON
  current_stage_id: string;
  current_stage_entered_at: string | null; // ISO timestamp for when the item entered the current stage
  current_stage_history_id: number | null; // ID of the item_history entry for entering the current stage
  quantity: number; // Add quantity field
  // Entry type information
  entry_type: 'normal' | 'reworked' | 'replacement'; // Whether this is a normal, reworked, or replacement entry
  rework_reasons?: string[]; // Rework reasons for reworked entries
  // Source item information (for creating separate entries)
  source_item_id: string; // The actual item ID from the items table
  // Composite item fields
  composite_group_id?: string | null;
  parent_composite_sku?: string | null;
  // Replacement tracking
  is_replacement?: boolean;
  replaced_item_id?: string | null;
  // Add other relevant item fields as needed
}

const fetchItemsInStage = async (
  organizationId: string,
  stageId: string,
  orderIdFilter: string | null
): Promise<ItemInStage[]> => {
  const supabase = await createClient();

  let query = supabase
    .from("item_stage_allocations") // Query item_stage_allocations table
    .select(
      `
      stage_id,
      quantity,
      allocation_type,
      items:items!inner (
        id,
        sku,
        order_id,
        composite_group_id,
        parent_composite_sku,
        is_replacement,
        replaced_item_id,
        orders:orders!inner (
          order_number
        ),
        instance_details,
        item_movement_history!item_movement_history_item_id_fkey (
          id,
          moved_at,
          from_stage_id,
          to_stage_id,
          quantity,
          rework_type,
          rework_reason
        )
      )
    `
    )
    .eq("organization_id", organizationId) // Filter on item_stage_allocations
    .eq("stage_id", stageId); // Filter on item_stage_allocations

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
        const typedAlloc = alloc as unknown as ItemAllocation;
        // Assuming alloc.items might be an array due to Supabase join behavior,
        // even with !inner, let's defensively access the first element.
        const itemDetails =
          Array.isArray(typedAlloc.items) && typedAlloc.items.length > 0
            ? typedAlloc.items[0]
            : !Array.isArray(typedAlloc.items)
              ? typedAlloc.items
              : null;

        if (!itemDetails) {
          // This case should ideally not be hit if items!inner works as expected
          // or if the data integrity (FK) is guaranteed.
          console.warn(
            "Skipping allocation due to missing item details:",
            typedAlloc
          );
          return null;
        }

        const movementEntries = itemDetails.item_movement_history || [];

        // Get movement specific to this allocation type
        let relevantMovement: HistoryMovementEntry | null = null;
        if (typedAlloc.allocation_type === 'reworked') {
          // For reworked allocations, find the latest rework movement that brought items to this stage
          const reworkMovements = movementEntries
            .filter(
              (h: HistoryMovementEntry) =>
                h.to_stage_id === typedAlloc.stage_id && h.rework_type === 'backward'
            )
            .sort(
              (a: HistoryMovementEntry, b: HistoryMovementEntry) =>
                new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()
            );
          relevantMovement = reworkMovements[0] ?? null;
        } else {
          // For normal allocations, find the latest forward movement that brought items to this stage
          const forwardMovements = movementEntries
            .filter(
              (h: HistoryMovementEntry) =>
                h.to_stage_id === typedAlloc.stage_id && 
                (h.rework_type === 'forward' || !h.rework_type)
            )
            .sort(
              (a: HistoryMovementEntry, b: HistoryMovementEntry) =>
                new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()
            );
          relevantMovement = forwardMovements[0] ?? null;
        }

        // Determine entry type based on item properties and allocation type
        let entryType: 'normal' | 'reworked' | 'replacement' = 'normal';
        if (itemDetails.is_replacement) {
          entryType = 'replacement';
        } else if (typedAlloc.allocation_type === 'reworked') {
          entryType = 'reworked';
        }
        
        // Debug logging for reworked allocations
        if (typedAlloc.allocation_type === 'reworked') {
          console.log('[DEBUG useItemsInStage] Reworked allocation found:', {
            item_id: itemDetails.id,
            sku: itemDetails.sku,
            stage_id: typedAlloc.stage_id,
            allocation_type: typedAlloc.allocation_type,
            quantity: typedAlloc.quantity,
            entryType: entryType
          });
        }

        const entry: ItemInStage = {
          id: `${itemDetails.id}_${typedAlloc.allocation_type}`,
          source_item_id: itemDetails.id,
          sku: itemDetails.sku,
          order_id: itemDetails.order_id,
          order_number: itemDetails.orders?.order_number ?? null,
          instance_details: itemDetails.instance_details,
          current_stage_id: typedAlloc.stage_id,
          current_stage_entered_at: relevantMovement?.moved_at ?? null,
          current_stage_history_id: relevantMovement?.id ?? null,
          quantity: typedAlloc.quantity,
          entry_type: entryType,
          composite_group_id: itemDetails.composite_group_id,
          parent_composite_sku: itemDetails.parent_composite_sku,
          is_replacement: itemDetails.is_replacement,
          replaced_item_id: itemDetails.replaced_item_id,
        };

        // Add rework reasons for reworked entries by analyzing movement history
        if (typedAlloc.allocation_type === 'reworked') {
          const reworkMovementsToStage = movementEntries.filter(
            (h: HistoryMovementEntry) => 
              h.to_stage_id === typedAlloc.stage_id && 
              (h.rework_type === 'backward' || 
               h.rework_type === 'rework' || 
               (h.rework_reason !== null && h.rework_reason !== undefined))
          );
          
          const reworkReasons = reworkMovementsToStage
            .map(m => m.rework_reason)
            .filter((reason): reason is string => reason !== null && reason !== undefined)
            .filter((reason, index, arr) => arr.indexOf(reason) === index);
          
          entry.rework_reasons = reworkReasons;
        }

        return [entry];
      })
      // Filter out any nulls that might have occurred
      .filter(Boolean) || [];

  // Flatten the array of entry arrays into a single array
  const flattenedData = processedData.flat();

  return flattenedData as ItemInStage[]; // Add type assertion back for safety
};

export const useItemsInStage = (
  organizationId: string | undefined | null,
  stageId: string,
  orderIdFilter: string | null
) => {
  // const { organizationId } = useAuth(); // Removed direct call

  return useQuery<ItemInStage[], Error>({
    queryKey: [
      "itemsInStage",
      organizationId,
      stageId,
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
        orderIdFilter
      );
    },
    // Query will only run if organizationId and stageId are truthy
    enabled: !!organizationId && !!stageId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
