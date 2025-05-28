"use client";

import { useQuery } from "@tanstack/react-query";

export interface ItemDetails {
  id: string;
  sku: string;
  buyer_id: string | null;
  total_quantity: number;
  remaining_quantity: number;
  status: string;
  instance_details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  order: {
    id: string;
    order_number: string | null;
    customer_name: string | null;
    created_at: string | null;
  };
}

export interface StageAllocation {
  id: string;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
  stage: {
    id: string;
    name: string;
    sequence_order: number;
    location: string | null;
  };
  sub_stage: {
    id: string;
    name: string;
    sequence_order: number;
    location: string | null;
  } | null;
}

export interface AllocationsByStage {
  stage: {
    id: string;
    name: string;
    sequence_order: number;
    location: string | null;
  };
  allocations: StageAllocation[];
  totalQuantity: number;
}

export interface MovementHistoryEntry {
  id: number;
  moved_at: string;
  quantity: number;
  rework_reason: string | null;
  from_stage_name: string | null;
  from_sub_stage_name: string | null;
  to_stage_name: string | null;
  to_sub_stage_name: string | null;
  moved_by_name: string | null;
}

export interface ItemDetailsSummary {
  total_quantity: number;
  quantity_in_workflow: number;
  quantity_in_new_pool: number;
  completed_quantity: number;
  remarks_count: number;
  images_count: number;
}

export interface ItemDetailsResponse {
  item: ItemDetails;
  allocations: StageAllocation[];
  allocationsByStage: AllocationsByStage[];
  history: MovementHistoryEntry[];
  summary: ItemDetailsSummary;
}

const fetchItemDetails = async (
  itemId: string
): Promise<ItemDetailsResponse> => {
  const response = await fetch(`/api/items/${itemId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch item details");
  }

  return response.json();
};

export const useItemDetails = (itemId: string | null) => {
  return useQuery({
    queryKey: ["item-details", itemId],
    queryFn: () => fetchItemDetails(itemId!),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
