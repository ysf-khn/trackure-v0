import { useQuery } from "@tanstack/react-query";

export interface DashboardStats {
  activeItems: number;
  activeOrders: number;
  itemsInRework: number;
  itemsWaitingOver7Days: number;
}

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const response = await fetch("/api/dashboard/stats");

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard statistics");
  }

  return response.json();
};

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (reduced from 30s)
    staleTime: 3 * 60 * 1000, // Consider data stale after 3 minutes (increased from 15s)
    // Only refetch when tab becomes visible if data is stale
    refetchOnWindowFocus: "always",
  });
}
