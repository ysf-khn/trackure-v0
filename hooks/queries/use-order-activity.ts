"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type OrderActivityEvent = {
  id: string;
  type: "created" | "item_added" | "item_updated" | "payment_updated" | "status_changed" | "item_moved";
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  metadata?: Record<string, any>;
};

async function fetchOrderActivity(orderId: string): Promise<OrderActivityEvent[]> {
  const supabase = createClient();
  const events: OrderActivityEvent[] = [];

  // Fetch order creation
  const { data: orderData } = await supabase
    .from("orders")
    .select("created_at, created_by_id")
    .eq("id", orderId)
    .single();

  if (orderData) {
    events.push({
      id: `order-created-${orderId}`,
      type: "created",
      title: "Order Created",
      description: "Order was created in the system",
      timestamp: orderData.created_at,
    });
  }

  // Fetch items added to order
  const { data: itemsData } = await supabase
    .from("items")
    .select("id, sku, total_quantity, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (itemsData) {
    itemsData.forEach((item) => {
      events.push({
        id: `item-added-${item.id}`,
        type: "item_added",
        title: "Item Added",
        description: `${item.sku} added with quantity ${item.total_quantity}`,
        timestamp: item.created_at,
      });
    });
  }

  // Fetch item movements
  const { data: movementsData } = await supabase
    .from("item_movement_history")
    .select(`
      id,
      moved_at,
      quantity,
      rework_reason,
      from_stage:from_stage_id(name),
      to_stage:to_stage_id(name),
      item:item_id(sku)
    `)
    .in("item_id", itemsData?.map(i => i.id) || [])
    .order("moved_at", { ascending: false })
    .limit(20);

  if (movementsData) {
    movementsData.forEach((movement: any) => {
      const isRework = !!movement.rework_reason;
      events.push({
        id: `movement-${movement.id}`,
        type: "item_moved",
        title: isRework ? "Item Rework" : "Item Moved Forward",
        description: isRework 
          ? `${movement.item?.sku} sent for rework: ${movement.rework_reason}`
          : `${movement.item?.sku} moved from ${movement.from_stage?.name || 'Start'} to ${movement.to_stage?.name}`,
        timestamp: movement.moved_at,
        metadata: {
          quantity: movement.quantity,
          fromStage: movement.from_stage?.name,
          toStage: movement.to_stage?.name,
        }
      });
    });
  }

  // Sort all events by timestamp (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

export function useOrderActivity(orderId: string) {
  return useQuery({
    queryKey: ["order-activity", orderId],
    queryFn: () => fetchOrderActivity(orderId),
    enabled: !!orderId,
    staleTime: 30000, // 30 seconds
  });
}