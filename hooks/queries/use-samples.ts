import { useQuery } from "@tanstack/react-query";

interface SampleAttribute {
  category: string;
  name: string;
  value: string;
  unit?: string;
}

interface Sample {
  id: string;
  organization_id: string;
  sample_code: string;
  name: string;
  description: string | null;
  sku: string | null;
  status: 'available' | 'with_customer' | 'in_production' | 'damaged' | 'lost';
  location: string | null;
  received_date: string | null;
  received_from: string | null;
  created_at: string;
  updated_at: string;
  attributes: SampleAttribute[];
  image_count: number;
}

interface SamplesResponse {
  samples: Sample[];
  meta: {
    total_count: number;
    available_count: number;
    with_customer_count: number;
    in_production_count: number;
    damaged_count: number;
    lost_count: number;
  };
}

export function useSamples() {
  return useQuery<SamplesResponse>({
    queryKey: ["samples"],
    queryFn: async () => {
      const response = await fetch("/api/samples");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch samples");
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}