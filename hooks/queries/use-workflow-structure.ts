"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
// Removed unused import and reference to potentially incorrect global type
// import { WorkflowStageWithSubStages } from "@/types/workflow";

// Define the specific type for the data fetched by this hook
// Export these types so they can be used by utility functions
export interface FetchedWorkflowStage {
  id: string;
  name: string | null; // Allow null for name
  sequence_order: number;
  location: string | null; // Optional location field
  parent_stage_id: string | null;
  depth_level: number;
  full_path: string | null;
  is_leaf_stage: boolean;
  sku: string | null;
  vendor_pricing_count?: number; // Count of active vendor pricing for this stage
  primaryVendor?: { name: string; firm_name?: string } | null; // Primary vendor info
  totalPrice?: { amount: number; currency: string } | null; // Total pricing for stage
  vendorCount?: number; // Total number of vendors for this stage
  children?: FetchedWorkflowStage[]; // Recursive for infinite nesting
  is_system_stage?: boolean; // Flag to identify system stages like "Completed"
  latestOrder?: { // Latest vendor order info
    total_amount: number;
    currency: string;
    quantity: number;
    vendor_id: string;
  } | null;
}

// --- Query Key Generator --- //
// Exported for use in mutations (invalidation)
export const getWorkflowQueryKey = (organizationId: string, selectedSKU?: string | null) => [
  "workflow",
  "structure",
  organizationId,
  selectedSKU,
];

// Build tree structure from flat array
const buildTree = (stages: any[], vendorOrders: any[], parentId: string | null = null): FetchedWorkflowStage[] => {
  return stages
    .filter(stage => stage.parent_stage_id === parentId)
    .map(stage => {
      const vendorPricing = Array.isArray(stage.vendor_stage_pricing) ? stage.vendor_stage_pricing : [];
      const vendorCount = vendorPricing.length;
      
      // Get primary vendor (first active vendor) and calculate total price
      let primaryVendor = null;
      let totalPrice = null;
      let latestOrder = null;
      
      if (vendorCount > 0) {
        const firstVendor = vendorPricing[0];
        if (firstVendor?.vendors) {
          primaryVendor = {
            name: firstVendor.vendors.name,
            firm_name: firstVendor.vendors.firm_name
          };
        }
        
        // Find the latest order for this stage
        const stageOrders = vendorOrders.filter((order: any) => order.stage_id === stage.id);
        if (stageOrders.length > 0) {
          // Get the most recent order (already sorted by created_at desc)
          const mostRecentOrder = stageOrders[0];
          latestOrder = {
            total_amount: mostRecentOrder.total_amount,
            currency: mostRecentOrder.currency,
            quantity: mostRecentOrder.quantity,
            vendor_id: mostRecentOrder.vendor_id
          };
          
          // Use the order's total amount as the totalPrice
          totalPrice = {
            amount: mostRecentOrder.total_amount,
            currency: mostRecentOrder.currency
          };
        } else {
          // Fallback to calculated price if no order exists
          const totalAmount = vendorPricing.reduce((sum: number, pricing: any) => {
            return sum + (parseFloat(pricing.price) || 0);
          }, 0);
          
          if (totalAmount > 0) {
            totalPrice = {
              amount: totalAmount,
              currency: vendorPricing[0]?.currency || 'INR'
            };
          }
        }
      }
      
      return {
        ...stage,
        vendor_pricing_count: vendorCount,
        primaryVendor,
        totalPrice,
        vendorCount,
        latestOrder,
        is_system_stage: stage.name === 'Completed', // Flag system stages
        children: buildTree(stages, vendorOrders, stage.id)
      };
    })
    .sort((a, b) => a.sequence_order - b.sequence_order);
};

// Fetch function to get workflow structure from Supabase
const fetchWorkflowStructure = async (
  organizationId: string,
  selectedSKU?: string | null
): Promise<FetchedWorkflowStage[]> => {
  const supabase = createClient();

  let query = supabase
    .from("workflow_stages")
    .select(
      `
      id,
      name,
      sequence_order,
      location,
      parent_stage_id,
      depth_level,
      full_path,
      is_leaf_stage,
      sku,
      vendor_stage_pricing!left(
        id,
        price,
        currency,
        vendors!inner(
          name,
          firm_name
        )
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("vendor_stage_pricing.is_active", true);

  // Filter by SKU - only look for SKU-specific stages
  if (selectedSKU) {
    query = query.eq("sku", selectedSKU);
  } else {
    query = query.is("sku", null);
  }

  const { data: workflowStages, error: workflowError } = await query.order("sequence_order", { ascending: true });

  if (workflowError) {
    console.error("Error fetching workflow structure:", workflowError);
    throw new Error(
      workflowError.message || "Failed to fetch workflow structure."
    );
  }

  // Fetch vendor orders for all stages to get actual order amounts
  let vendorOrders: any[] = [];
  if (workflowStages && workflowStages.length > 0) {
    const stageIds = workflowStages.map(stage => stage.id);
    const { data: orders, error: ordersError } = await supabase
      .from("vendor_orders")
      .select(
        `
        id,
        vendor_id,
        stage_id,
        quantity,
        unit_price,
        total_amount,
        currency,
        status,
        created_at
      `
      )
      .in("stage_id", stageIds)
      .eq("organization_id", organizationId)
      .in("status", ["pending", "in_progress", "completed"])
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching vendor orders:", ordersError);
      // Don't throw, just continue without orders
    } else {
      vendorOrders = orders || [];
    }
  }

  // Build the tree structure from flat data with vendor orders
  const treeStructure = buildTree(workflowStages || [], vendorOrders);
  
  return treeStructure;
};

// --- TanStack Query Hook --- //
export const useWorkflowStructure = (
  organizationId: string | undefined | null,
  selectedSKU?: string | null
) => {
  return useQuery<FetchedWorkflowStage[], Error>({
    queryKey: getWorkflowQueryKey(organizationId || "", selectedSKU), // Use the key generator
    queryFn: () => {
      if (!organizationId) {
        // Or throw an error, or return a default value like []
        return Promise.resolve([]);
      }
      return fetchWorkflowStructure(organizationId, selectedSKU);
    },
    enabled: !!organizationId, // Only run the query if organizationId is available
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
