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
  // Composite item fields
  composite_group_id: string | null;
  parent_composite_sku: string | null;
  // Replacement tracking
  is_replacement?: boolean;
  replaced_item_id?: string | null;
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
  console.log("🔍 fetchOrderItems called with:", { organizationId, orderId, orderIdType: typeof orderId });
  
  const supabase = await createClient();

  // First, try to fetch ALL items for this organization to debug
  console.log("🔍 DEBUG: Fetching ALL items for organization to check if any exist...");
  const { data: allItems, error: allItemsError } = await supabase
    .from("items")
    .select("id, sku, order_id")
    .eq("organization_id", organizationId)
    .limit(10);
  
  console.log("🔍 DEBUG: All items in organization:", { 
    count: allItems?.length || 0, 
    items: allItems,
    error: allItemsError 
  });

  // First fetch the items for this order
  console.log("📡 Making Supabase query for items...");
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
      updated_at,
      composite_group_id,
      parent_composite_sku,
      order_id,
      is_replacement,
      replaced_item_id
    `
    )
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  console.log("📊 Items query result:", { 
    items: items?.length || 0, 
    error: itemsError,
    rawItems: items 
  });

  if (itemsError) {
    console.error("❌ Error fetching order items:", itemsError);
    throw new Error(itemsError.message);
  }

  if (!items || items.length === 0) {
    console.log("⚠️ No items found for this order");
    
    // Debug: Try alternative query methods
    console.log("🔍 DEBUG: Trying alternative query approaches...");
    
    // Try without composite filters
    const { data: altItems, error: altError } = await supabase
      .from("items")
      .select("id, sku, composite_group_id, parent_composite_sku")
      .eq("organization_id", organizationId)
      .eq("order_id", orderId);
      
    console.log("🔍 DEBUG: Alternative query result:", { 
      items: altItems?.length || 0,
      error: altError,
      data: altItems
    });
    
    return [];
  }

  // Fetch stage allocations for all items (simplified query)
  const itemIds = items.map((item) => item.id);
  console.log("📋 Fetching allocations for item IDs:", itemIds);
  
  // Try a simpler query first to avoid JOIN issues
  const { data: allocations, error: allocationsError } = await supabase
    .from("item_stage_allocations")
    .select(
      `
      item_id,
      quantity,
      stage_id,
      sub_stage_id
    `
    )
    .in("item_id", itemIds)
    .eq("organization_id", organizationId);
  
  console.log("📋 Allocations query result:", { 
    allocations: allocations?.length || 0, 
    error: allocationsError,
    rawAllocations: allocations 
  });

  // Don't throw error for allocations - just continue without stage info
  if (allocationsError) {
    console.error("⚠️ Error fetching stage allocations (continuing without stage info):", allocationsError);
  }

  // Process the data to combine items with their allocations
  console.log("⚙️ Processing items data...");
  const processedItems: OrderItem[] = items.map((item) => {
    // Get allocations for this item
    const itemAllocations =
      allocations?.filter((alloc) => alloc.item_id === item.id) || [];

    // Calculate quantity in workflow
    const quantityInWorkflow = itemAllocations.reduce(
      (sum, alloc) => sum + alloc.quantity,
      0
    );

    // Process stage allocations (simplified - no stage names for now)
    const stageAllocations = itemAllocations.map((alloc) => ({
      stage_id: alloc.stage_id,
      stage_name: "Stage Info Loading...", // Will fix this later
      sub_stage_id: alloc.sub_stage_id,
      sub_stage_name: null,
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
      composite_group_id: item.composite_group_id,
      parent_composite_sku: item.parent_composite_sku,
      is_replacement: item.is_replacement,
      replaced_item_id: item.replaced_item_id,
      stage_allocations: stageAllocations,
      quantity_in_workflow: quantityInWorkflow,
      quantity_in_new_pool: item.remaining_quantity - quantityInWorkflow,
    };
  });

  console.log("✅ Processed items:", { 
    total: processedItems.length,
    regularItems: processedItems.filter(i => !i.composite_group_id).length,
    compositeItems: processedItems.filter(i => i.composite_group_id).length,
    items: processedItems
  });

  return processedItems;
};

export const useOrderItems = (
  organizationId: string | undefined | null,
  orderId: string
) => {
  console.log("🎣 useOrderItems hook called with:", { organizationId, orderId });
  
  return useQuery<OrderItem[], Error>({
    queryKey: ["orderItems", organizationId, orderId],
    queryFn: () => {
      console.log("🚀 useOrderItems queryFn executing...");
      if (!organizationId || !orderId) {
        console.log("❌ Missing required params:", { organizationId, orderId });
        return Promise.resolve([]);
      }
      return fetchOrderItems(organizationId, orderId);
    },
    enabled: !!organizationId && !!orderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
