// Dodo Payments Webhook Types
export interface DodoWebhookHeaders {
  "webhook-id": string;
  "webhook-signature": string;
  "webhook-timestamp": string;
}

export interface DodoCustomer {
  customer_id: string;
  email: string;
  name: string;
}

export interface DodoDispute {
  amount: string;
  business_id: string;
  created_at: string;
  currency: string;
  dispute_id: string;
  dispute_stage: "pre_dispute" | string;
  dispute_status: "dispute_opened" | string;
  payment_id: string;
}

export interface DodoRefund {
  amount: number;
  business_id: string;
  created_at: string;
  currency: string;
  payment_id: string;
  reason: string;
  refund_id: string;
  status: "succeeded" | "failed";
}

export interface DodoProductCartItem {
  product_id: string;
  quantity: number;
}

export interface DodoPaymentWebhookPayload {
  business_id: string;
  created_at: string;
  currency: string;
  customer: DodoCustomer;
  discount_id?: string;
  disputes?: DodoDispute[];
  error_message?: string;
  metadata?: Record<string, any>;
  payment_id: string;
  payment_link?: string;
  payment_method: string;
  payment_method_type: string;
  product_cart: DodoProductCartItem[];
  refunds?: DodoRefund[];
  status: "succeeded" | "failed" | "processing" | "cancelled";
  subscription_id?: string;
  tax?: number;
  total_amount: number;
  updated_at: string;
}

export interface DodoBillingInfo {
  city: string;
  country: string;
  state: string;
  street: string;
  zipcode: string;
}

export interface DodoSubscriptionWebhookPayload {
  billing: DodoBillingInfo;
  created_at: string;
  currency: string;
  // Add other subscription fields as needed
}

export type WebhookPayload =
  | DodoPaymentWebhookPayload
  | DodoSubscriptionWebhookPayload;
