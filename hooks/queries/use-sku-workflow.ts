import { useQuery } from "@tanstack/react-query";

interface WorkflowStage {
  id: string;
  name: string;
  itemCount: number;
  sku: string | null;
  sequence_order: number;
  depth_level: number;
  full_path: string | null;
  is_leaf_stage: boolean;
  subStages?: WorkflowStage[];
}

interface SKUOption {
  value: string;
  label: string;
  itemCount: number;
}

interface SKUWorkflowResponse {
  stages: WorkflowStage[];
  availableSKUs: SKUOption[];
  selectedSKU: string | null;
}

export function useSKUWorkflow(sku: string | null = null) {
  return useQuery<SKUWorkflowResponse>({
    queryKey: ["sku-workflow", sku],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sku) {
        params.set("sku", sku);
      }
      
      const response = await fetch(`/api/sku-workflows?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch SKU workflow");
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}