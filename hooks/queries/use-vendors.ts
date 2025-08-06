import { useQuery } from "@tanstack/react-query";

interface VendorStats {
  active_pricing_count: number;
  supported_skus: number;
  supported_stages: number;
  avg_price: number;
  avg_lead_time: number;
}

interface VendorPricing {
  id: string;
  stage_id: string;
  sku: string;
  price: number;
  currency: string;
  price_unit: string;
  minimum_quantity: number;
  lead_time_days: number;
  is_active: boolean;
  stage: {
    name: string;
    full_path: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  firm_name: string | null;
  gst: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pricing: VendorPricing[];
  stats: VendorStats;
}

interface VendorsResponse {
  vendors: Vendor[];
  meta: {
    total_count: number;
    active_count: number;
    inactive_count: number;
  };
}

export function useVendors(includeInactive = false) {
  return useQuery<VendorsResponse>({
    queryKey: ["vendors", includeInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) {
        params.set("include_inactive", "true");
      }
      
      const response = await fetch(`/api/vendors?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendors");
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}