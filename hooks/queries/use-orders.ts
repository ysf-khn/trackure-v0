import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  payment_status: string | null;
  status: string | null;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  skus?: string[]; // List of unique SKUs in this order
}

const fetchOrders = async (organizationId: string): Promise<Order[]> => {
  const supabase = await createClient();

  // Fetch orders
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      customer_name,
      payment_status,
      status,
      total_quantity,
      created_at,
      updated_at
    `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("Error fetching orders:", ordersError);
    throw new Error(ordersError.message);
  }

  if (!orders || orders.length === 0) {
    return [];
  }

  // Fetch SKUs for each order
  const orderIds = orders.map((order) => order.id);
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("order_id, sku")
    .in("order_id", orderIds)
    .eq("organization_id", organizationId);

  if (itemsError) {
    console.error("Error fetching order items:", itemsError);
    throw new Error(itemsError.message);
  }

  // Group SKUs by order
  const skusByOrder = items?.reduce((acc, item) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = new Set<string>();
    }
    acc[item.order_id].add(item.sku);
    return acc;
  }, {} as Record<string, Set<string>>) || {};

  // Combine orders with their SKUs
  const ordersWithSkus: Order[] = orders.map((order) => ({
    ...order,
    skus: Array.from(skusByOrder[order.id] || []),
  }));

  return ordersWithSkus;
};

export const useOrders = (
  organizationId: string | undefined | null
) => {
  return useQuery<Order[], Error>({
    queryKey: ["orders", organizationId],
    queryFn: () => {
      if (!organizationId) {
        return Promise.resolve([]);
      }
      return fetchOrders(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};