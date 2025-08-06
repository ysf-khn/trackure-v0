"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

interface SingleStageItemCount {
  stageId: string;
  itemCount: number;
  totalQuantity: number;
  normalQuantity: number;
  reworkedQuantity: number;
}

export function useSingleStageItemCounts(
  organizationId: string | null | undefined,
  stageId: string | null | undefined,
  sku?: string | null
) {
  return useQuery<SingleStageItemCount>({
    queryKey: ["single-stage-item-counts", organizationId, stageId, sku],
    queryFn: async (): Promise<SingleStageItemCount> => {
      if (!organizationId || !stageId) {
        return {
          stageId: stageId || "",
          itemCount: 0,
          totalQuantity: 0,
          normalQuantity: 0,
          reworkedQuantity: 0,
        };
      }

      const supabase = createClient();

      // Query to get item counts for the specific stage
      let query = supabase
        .from("item_stage_allocations")
        .select(
          `
          stage_id,
          quantity,
          allocation_type,
          items!inner(sku)
        `
        )
        .eq("stage_id", stageId)
        .eq("items.organization_id", organizationId)
        .eq("status", "active");

      // Filter by SKU if provided
      if (sku) {
        query = query.eq("items.sku", sku);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching single stage item counts:", error);
        throw new Error(error.message);
      }

      // Calculate counts
      let itemCount = 0;
      let totalQuantity = 0;
      let normalQuantity = 0;
      let reworkedQuantity = 0;

      if (data) {
        data.forEach((allocation: any) => {
          const quantity = allocation.quantity || 0;
          const allocationType = allocation.allocation_type || "normal";

          itemCount += 1;
          totalQuantity += quantity;

          if (allocationType === "reworked") {
            reworkedQuantity += quantity;
          } else {
            normalQuantity += quantity;
          }
        });
      }

      return {
        stageId,
        itemCount,
        totalQuantity,
        normalQuantity,
        reworkedQuantity,
      };
    },
    enabled: !!organizationId && !!stageId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}