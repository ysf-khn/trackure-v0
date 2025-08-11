"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface SKUWorkflowState {
  has_active_items: boolean;
  active_item_count: number;
  active_items_in_workflow: number;
  has_workflow_stages: boolean;
  workflow_stage_count: number;
  has_templates: boolean;
  template_count: number;
  active_template_id: string | null;
  active_template_name: string | null;
  workflow_type: 'sku' | 'organization' | null;
  first_stage_id: string | null;
  first_stage_name: string | null;
}

// Query key generator for cache invalidation
export const getSKUWorkflowStateKey = (sku: string | null, organizationId: string | null) => [
  "sku-workflow-state",
  sku,
  organizationId,
];

// Fetch SKU workflow state from database
const fetchSKUWorkflowState = async (
  sku: string,
  organizationId: string
): Promise<SKUWorkflowState | null> => {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_sku_workflow_state', {
    p_sku: sku,
    p_organization_id: organizationId
  });

  if (error) {
    console.error("Error fetching SKU workflow state:", error);
    throw new Error(error.message || "Failed to fetch SKU workflow state");
  }

  // The RPC returns an array with one row
  return data && data.length > 0 ? data[0] : null;
};

// Hook to use SKU workflow state
export const useSKUWorkflowState = (
  sku: string | null,
  organizationId: string | null,
  enabled: boolean = true
) => {
  return useQuery<SKUWorkflowState | null, Error>({
    queryKey: getSKUWorkflowStateKey(sku, organizationId),
    queryFn: async () => {
      if (!sku || !organizationId) {
        return null;
      }
      return fetchSKUWorkflowState(sku, organizationId);
    },
    enabled: enabled && !!sku && !!organizationId,
    staleTime: 1000 * 60, // Cache for 1 minute
  });
};

// Helper function to determine allocation strategy
export const getAllocationStrategy = (state: SKUWorkflowState | null) => {
  if (!state) {
    return {
      strategy: 'configure',
      message: 'Unable to determine workflow state',
      canAllocate: false,
      needsTemplate: false,
      needsConfiguration: true
    };
  }

  // Case 1: SKU has active items already in workflow - add to existing
  if (state.active_items_in_workflow > 0) {
    return {
      strategy: 'add-to-existing',
      message: `${state.active_items_in_workflow} item(s) of this SKU are already in workflow. New items will be added to the existing workflow.`,
      canAllocate: true,
      needsTemplate: false,
      needsConfiguration: false,
      defaultStageId: state.first_stage_id
    };
  }

  // Case 2: SKU has workflow stages configured - use existing workflow
  if (state.has_workflow_stages) {
    return {
      strategy: 'use-existing-workflow',
      message: `Using ${state.workflow_type === 'sku' ? 'SKU-specific' : 'organization'} workflow with ${state.workflow_stage_count} stages.`,
      canAllocate: true,
      needsTemplate: false,
      needsConfiguration: false,
      defaultStageId: state.first_stage_id
    };
  }

  // Case 3: SKU has templates but no workflow - apply template first
  if (state.has_templates) {
    return {
      strategy: 'apply-template',
      message: state.active_template_id 
        ? `Template "${state.active_template_name}" is available. It will be applied before allocation.`
        : `${state.template_count} template(s) available. Select one to create workflow.`,
      canAllocate: true,
      needsTemplate: true,
      needsConfiguration: false,
      activeTemplateId: state.active_template_id
    };
  }

  // Case 4: No workflow and no templates - need configuration
  return {
    strategy: 'configure',
    message: 'No workflow configured for this SKU. Please configure the workflow first.',
    canAllocate: false,
    needsTemplate: false,
    needsConfiguration: true
  };
};