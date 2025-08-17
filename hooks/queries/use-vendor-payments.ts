import { useQuery } from "@tanstack/react-query";

interface VendorPayment {
  id: string;
  vendor_id: string;
  vendor_order_id: string;
  payment_type: "advance" | "part_payment" | "force_closure" | "closure";
  amount_paid: number;
  total_order_amount: number;
  remaining_amount: number;
  remarks: string | null;
  payment_date: string;
  is_carried_forward: boolean;
  carried_from_payment_id: string | null;
  carried_to_order_id: string | null;
  order: {
    order_number: string;
    sku: string;
    quantity: number;
    status: string;
  } | null;
  created_by: string;
}

interface VendorPaymentsResponse {
  payments: VendorPayment[];
  statistics: {
    total_payments: number;
    total_amount_paid: number;
    payment_types: {
      advance: number;
      part_payment: number;
      force_closure: number;
      closure: number;
    };
    carried_forward_count: number;
    outstanding_summary: {
      total_outstanding: number;
      outstanding_orders: any[];
    };
  };
}

interface VendorPaymentsFilters {
  orderId?: string;
  paymentType?: string;
  includeCarriedForward?: boolean;
}

export function useVendorPayments(
  vendorId: string,
  filters: VendorPaymentsFilters = {}
) {
  return useQuery<VendorPaymentsResponse>({
    queryKey: ["vendor-payments", vendorId, filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (filters.orderId) {
        searchParams.set("order_id", filters.orderId);
      }
      if (filters.paymentType) {
        searchParams.set("payment_type", filters.paymentType);
      }
      if (filters.includeCarriedForward) {
        searchParams.set("include_carried_forward", "true");
      }

      const url = `/api/vendors/${vendorId}/payments${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor payments");
      }
      
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}