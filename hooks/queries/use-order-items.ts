import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface OrderItem {
  id: string;
  sku: string;
  buyer_id: string | null;
  total_quantity: number;
  remaining_quantity: number;
  status: string;
  instance_details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Stage allocation summary
  stage_allocations: {
    stage_id: string;
    stage_name: string;
    sub_stage_id: string | null;
    sub_stage_name: string | null;
    quantity: number;
  }[];
  // Total quantity in workflow vs new pool
  quantity_in_workflow: number;
  quantity_in_new_pool: number;
}

const fetchOrderItems = async (
  organizationId: string,
  orderId: string
): Promise<OrderItem[]> => {
  const supabase = await createClient();

  // First fetch the items for this order
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select(
      `
      id,
      sku,
      buyer_id,
      total_quantity,
      remaining_quantity,
      status,
      instance_details,
      created_at,
      updated_at
    `
    )
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (itemsError) {
    console.error("Error fetching order items:", itemsError);
    throw new Error(itemsError.message);
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Fetch stage allocations for all items
  const itemIds = items.map((item) => item.id);
  const { data: allocations, error: allocationsError } = await supabase
    .from("item_stage_allocations")
    .select(
      `
      item_id,
      quantity,
      stage_id,
      sub_stage_id,
      workflow_stages!inner (
        name
      ),
      workflow_sub_stages (
        name
      )
    `
    )
    .in("item_id", itemIds)
    .eq("organization_id", organizationId);

  if (allocationsError) {
    console.error("Error fetching stage allocations:", allocationsError);
    throw new Error(allocationsError.message);
  }

  // Process the data to combine items with their allocations
  const processedItems: OrderItem[] = items.map((item) => {
    // Get allocations for this item
    const itemAllocations =
      allocations?.filter((alloc) => alloc.item_id === item.id) || [];

    // Calculate quantity in workflow
    const quantityInWorkflow = itemAllocations.reduce(
      (sum, alloc) => sum + alloc.quantity,
      0
    );

    // Process stage allocations
    const stageAllocations = itemAllocations.map((alloc) => ({
      stage_id: alloc.stage_id,
      stage_name: (alloc.workflow_stages as any)?.name || "Unknown Stage",
      sub_stage_id: alloc.sub_stage_id,
      sub_stage_name: (alloc.workflow_sub_stages as any)?.name || null,
      quantity: alloc.quantity,
    }));

    return {
      id: item.id,
      sku: item.sku,
      buyer_id: item.buyer_id,
      total_quantity: item.total_quantity,
      remaining_quantity: item.remaining_quantity,
      status: item.status,
      instance_details: item.instance_details,
      created_at: item.created_at,
      updated_at: item.updated_at,
      stage_allocations: stageAllocations,
      quantity_in_workflow: quantityInWorkflow,
      quantity_in_new_pool: item.total_quantity - quantityInWorkflow,
    };
  });

  return processedItems;
};

export const useOrderItems = (
  organizationId: string | undefined | null,
  orderId: string
) => {
  return useQuery<OrderItem[], Error>({
    queryKey: ["orderItems", organizationId, orderId],
    queryFn: () => {
      if (!organizationId || !orderId) {
        return Promise.resolve([]);
      }
      return fetchOrderItems(organizationId, orderId);
    },
    enabled: !!organizationId && !!orderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
