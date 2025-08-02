import { useQuery } from "@tanstack/react-query";

interface SKUData {
  sku: string;
  sku_name?: string;
}

interface SKUsResponse {
  skus: SKUData[];
}

export function useSKUs() {
  return useQuery<SKUsResponse>({
    queryKey: ["skus"],
    queryFn: async () => {
      const response = await fetch("/api/item-master/skus");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch SKUs");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}