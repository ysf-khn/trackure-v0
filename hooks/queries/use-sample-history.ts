import { useQuery } from "@tanstack/react-query";

interface HistoryEntry {
  id: string;
  change_type: 'created' | 'updated' | 'location_changed' | 'quantity_changed' | 'attribute_changed' | 'deleted';
  field_name?: string | null;
  old_value?: any;
  new_value?: any;
  change_reason?: string | null;
  changed_at: string;
  changed_by: string;
  changed_by_name: string;
  snapshot?: any;
}

interface SampleHistoryResponse {
  history: HistoryEntry[];
}

export function useSampleHistory(sampleId: string, enabled = true) {
  return useQuery<SampleHistoryResponse>({
    queryKey: ["sample-history", sampleId],
    queryFn: async () => {
      const response = await fetch(`/api/samples/${sampleId}/history`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sample history");
      }
      
      return response.json();
    },
    enabled: enabled && !!sampleId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}