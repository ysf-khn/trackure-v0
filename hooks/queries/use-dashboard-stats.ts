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
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}
