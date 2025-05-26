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
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
