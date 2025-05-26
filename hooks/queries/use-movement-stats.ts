import { useQuery } from "@tanstack/react-query";

export interface MovementStatsData {
  date: string;
  forward: number;
  rework: number;
}

const fetchMovementStats = async (
  days: number = 90
): Promise<MovementStatsData[]> => {
  const response = await fetch(`/api/dashboard/movement-stats?days=${days}`);

  if (!response.ok) {
    throw new Error("Failed to fetch movement statistics");
  }

  return response.json();
};

export function useMovementStats(days: number = 90) {
  return useQuery({
    queryKey: ["movement-stats", days],
    queryFn: () => fetchMovementStats(days),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
