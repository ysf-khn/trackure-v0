import { useQuery } from "@tanstack/react-query";

export type DatePeriod = 
  | "last_7_days" 
  | "last_30_days" 
  | "last_90_days" 
  | "this_month" 
  | "last_month" 
  | "custom";

interface VendorPaymentSummaryFilters {
  period?: DatePeriod;
  fromDate?: string;
  toDate?: string;
}

interface VendorPaymentSummaryResponse {
  dateRange: {
    from: string;
    to: string;
    period: string;
  };
  vendors: {
    total: number;
    active: number;
    withActivityInPeriod: number;
  };
  payments: {
    total: number;
    count: number;
    breakdown: {
      advance: number;
      part_payment: number;
      force_closure: number;
      closure: number;
    };
  };
  outstanding: {
    total: number;
    orderCount: number;
  };
}

export function useVendorPaymentSummary(filters: VendorPaymentSummaryFilters = {}) {
  const { period = "last_30_days", fromDate, toDate } = filters;

  return useQuery<VendorPaymentSummaryResponse>({
    queryKey: ["vendor-payment-summary", period, fromDate, toDate],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      searchParams.set("period", period);
      
      if (period === "custom" && fromDate && toDate) {
        searchParams.set("from_date", fromDate);
        searchParams.set("to_date", toDate);
      }

      const url = `/api/vendors/payment-summary?${searchParams.toString()}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor payment summary");
      }
      
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}