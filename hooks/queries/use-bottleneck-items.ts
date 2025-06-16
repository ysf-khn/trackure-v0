import { useQuery } from "@tanstack/react-query";
import { BottleneckItem } from "@/app/api/dashboard/bottleneck-items/route";

const fetchBottleneckItems = async (
  limit: number = 10
): Promise<BottleneckItem[]> => {
  const response = await fetch(
    `/api/dashboard/bottleneck-items?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch bottleneck items");
  }

  return response.json();
};

export function useBottleneckItems(limit: number = 10) {
  return useQuery({
    queryKey: ["bottleneck-items", limit],
    queryFn: () => fetchBottleneckItems(limit),
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes (reduced from 1 minute)
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes (increased from 30s)
    // Only refetch when tab becomes visible if data is stale
    refetchOnWindowFocus: "always",
  });
}
