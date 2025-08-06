"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

export interface StageVendorPricing {
  id: string;
  vendor_id: string;
  stage_id: string;
  sku: string;
  price: number;
  currency: string;
  price_unit: string;
  minimum_quantity: number;
  lead_time_days: number;
  notes: string | null;
  is_active: boolean;
  vendor: {
    id: string;
    name: string;
    firm_name: string | null;
    is_active: boolean;
  };
}

export interface StageVendorPricingResult {
  vendorPricing: StageVendorPricing[];
}

async function fetchStageVendorPricing(stageId: string): Promise<StageVendorPricingResult> {
  try {
    const response = await fetch(`/api/settings/workflow/stages/${stageId}/vendor-pricing`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || "Failed to fetch vendor pricing");
    }
    
    const data = await response.json();
    return data || { vendorPricing: [] };
  } catch (error) {
    console.error('Error fetching stage vendor pricing:', error);
    throw error;
  }
}

export function useStageVendorPricing(stageId: string | null | undefined) {
  return useQuery<StageVendorPricingResult, Error>({
    queryKey: ["stage-vendor-pricing", stageId],
    queryFn: () => {
      if (!stageId) {
        return Promise.resolve({ vendorPricing: [] });
      }
      return fetchStageVendorPricing(stageId);
    },
    enabled: !!stageId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}