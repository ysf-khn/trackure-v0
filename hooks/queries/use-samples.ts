import { useQuery } from "@tanstack/react-query";

interface SampleAttribute {
  attribute_name: string;
  attribute_value: string;
  attribute_unit?: string | null;
}

interface Sample {
  id: string;
  organization_id: string;
  sku: string;
  sample_code: string;
  name: string;
  description?: string | null;
  location?: string | null;
  status: string;
  received_date?: string | null;
  received_from?: string | null;
  attributes?: SampleAttribute[];
  created_at: string;
  updated_at: string;
  created_by: string;
  thumbnailUrl?: string | null;
  imageCount?: number;
}

interface SamplesResponse {
  samples: Sample[];
  meta: {
    total_count: number;
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