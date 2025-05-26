import { useState, useEffect } from "react";

export interface SubscriptionDetails {
  subscription_id: string;
  status:
    | "pending"
    | "active"
    | "on_hold"
    | "paused"
    | "cancelled"
    | "failed"
    | "expired";
  product_id: string;
  recurring_pre_tax_amount: number;
  currency: string;
  next_billing_date: string;
  previous_billing_date: string;
  trial_period_days: number;
  customer: {
    customer_id: string;
    email: string;
    name: string;
  };
  billing: {
    city: string;
    country: string;
    state: string;
    street: string;
    zipcode: string;
  };
  created_at: string;
  cancelled_at?: string;
  payment_frequency_interval: "Day" | "Week" | "Month" | "Year";
  payment_frequency_count: number;
  subscription_period_interval: "Day" | "Week" | "Month" | "Year";
  subscription_period_count: number;
  quantity: number;
  tax_inclusive: boolean;
  on_demand: boolean;
  addons: Array<{
    addon_id: string;
    quantity: number;
  }>;
  discount_id?: string;
  metadata: Record<string, any>;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionDetails | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export default function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/subscription/details");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // No subscription found - this is valid state
          setSubscription(null);
          return;
        }
        throw new Error(data.error || "Failed to fetch subscription");
      }

      setSubscription(data);
    } catch (e) {
      console.error("Error fetching subscription:", e);
      setError(e instanceof Error ? e.message : "An unknown error occurred");
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  return {
    subscription,
    isLoading,
    error,
    refetch: fetchSubscription,
  };
}
