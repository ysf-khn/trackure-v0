// TypeScript types for Composite Items feature

export interface CompositeItemDefinition {
  id: string;
  composite_sku: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompositeItemComponent {
  id: string;
  composite_definition_id: string;
  component_sku: string;
  organization_id: string;
  quantity_per_composite: number;
  created_at: string;
}

export interface CompositeItemDefinitionWithComponents
  extends CompositeItemDefinition {
  component_count: number;
  total_component_quantity: number;
  components: {
    component_sku: string;
    quantity_per_composite: number;
  }[];
}

export interface CompositeItemStatus {
  composite_group_id: string;
  parent_composite_sku: string;
  order_id: string;
  order_number: string;
  customer_name?: string;
  total_components: number;
  completed_components: number;
  unique_component_types: number;
  total_component_quantity: number;
  completed_component_quantity: number;
  completion_percentage: number;
  composite_status: "Not Started" | "In Progress" | "Completed";
  created_at: string;
  last_updated: string;
  organization_id: string;
}

export interface CompositeCompletionStatus {
  total_components: number;
  completed_components: number;
  completion_percentage: number;
  status: "Not Started" | "In Progress" | "Completed";
}

// API request/response types
export interface CreateCompositeItemRequest {
  composite_sku: string;
  name: string;
  description?: string;
  components: {
    component_sku: string;
    quantity_per_composite: number;
  }[];
}

export interface UpdateCompositeItemRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
  components?: {
    component_sku: string;
    quantity_per_composite: number;
  }[];
}

export interface AddComponentRequest {
  component_sku: string;
  quantity_per_composite: number;
}

export interface UpdateComponentRequest {
  quantity_per_composite: number;
}

// Enhanced item types to include composite information
export interface ItemWithCompositeInfo {
  id: string;
  order_id: string;
  sku: string;
  buyer_id?: string;
  instance_details?: Record<string, unknown>;
  total_quantity: number;
  remaining_quantity: number;
  organization_id: string;
  created_at: string;
  updated_at: string;
  status: string;

  // Composite-specific fields
  composite_group_id?: string;
  parent_composite_sku?: string;
  is_composite_component: boolean;
}

// For grouping items by composite group
export interface CompositeItemGroup {
  composite_group_id: string;
  parent_composite_sku: string;
  order_number: string;
  customer_name?: string;
  components: ItemWithCompositeInfo[];
  completion_status: CompositeCompletionStatus;
}

// API response types
export interface CompositeItemsResponse {
  composite_items: CompositeItemDefinitionWithComponents[];
  total_count: number;
}

export interface CompositeItemResponse {
  composite_item: CompositeItemDefinitionWithComponents;
}

export interface CompositeItemStatusResponse {
  composite_statuses: CompositeItemStatus[];
  total_count: number;
}

// Error types
export interface CompositeItemError {
  error: string;
  details?: string;
  field?: string;
}

// Validation schemas for Zod (to be used in API routes)
export interface CompositeItemValidation {
  CREATE_COMPOSITE_ITEM: any; // Will be defined with Zod
  UPDATE_COMPOSITE_ITEM: any;
  ADD_COMPONENT: any;
  UPDATE_COMPONENT: any;
}
