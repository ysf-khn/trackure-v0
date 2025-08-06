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

// Dashboard API Types
export interface BottleneckItem {
  item_id: string;
  sku: string;
  order_number: string;
  current_stage_name: string;
  time_in_current_stage: string; // Human-readable duration
  stage_entry_time: string; // ISO timestamp
  quantity: number;
}

// Sample Management Types
export interface SampleCustomAttribute {
  name: string;
  value: string;
  unit?: string | null;
}

export interface SampleLocationDetails {
  // For organization location type
  internal_location?: string;
  
  // For vendor location type
  vendor_id?: string;
  vendor_name?: string;
  
  // For customer location type
  customer_name?: string;
  customer_contact?: string;
  
  // For other location type
  location_name?: string;
  location_address?: string;
}

export interface Sample {
  id: string;
  organization_id: string;
  sample_code: string;
  sku: string;
  sku_name?: string | null;
  quantity: number;
  location_type: 'organization' | 'vendor' | 'customer' | 'other';
  location_details: SampleLocationDetails;
  location_vendor_name?: string | null;
  size: string;
  finish?: string | null;
  finish_vendor_id?: string | null;
  finish_vendor_name?: string | null;
  engraving?: string | null;
  engraving_vendor_id?: string | null;
  engraving_vendor_name?: string | null;
  custom_attributes?: SampleCustomAttribute[];
  image_count: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SampleHistoryEntry {
  id: string;
  change_type: 'created' | 'updated' | 'location_changed' | 'quantity_changed' | 'attribute_changed' | 'deleted';
  field_name?: string | null;
  old_value?: any;
  new_value?: any;
  change_reason?: string | null;
  changed_at: string;
  changed_by: string;
  changed_by_name: string;
  snapshot?: any;
}

export interface CreateSampleRequest {
  sku: string;
  quantity: number;
  size: string;
  location_type: 'organization' | 'vendor' | 'customer' | 'other';
  
  // Location-specific fields
  internal_location?: string;
  vendor_id?: string;
  customer_name?: string;
  customer_contact?: string;
  location_name?: string;
  location_address?: string;
  
  // Standard attributes with vendor links
  finish?: string;
  finish_vendor_id?: string;
  engraving?: string;
  engraving_vendor_id?: string;
  
  // Custom attributes
  custom_attributes?: SampleCustomAttribute[];
}

export interface UpdateSampleRequest extends Partial<CreateSampleRequest> {
  // All fields are optional for updates
}

export interface SamplesResponse {
  samples: Sample[];
  meta: {
    total_count: number;
    total_quantity: number;
    organization_count: number;
    vendor_count: number;
    customer_count: number;
    other_count: number;
  };
}

export interface SampleHistoryResponse {
  history: SampleHistoryEntry[];
}
