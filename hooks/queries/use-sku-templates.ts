"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface WorkflowTemplateStage {
  id: string;
  name: string;
  sequence_order: number;
  depth_level: number;
  is_leaf_stage: boolean;
  location: string | null;
  avg_time_hours: number | null;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  completed_count: number;
  avg_completion_days: number | null;
  created_at: string;
  updated_at: string;
  stages?: WorkflowTemplateStage[];
}

// Query key generator
export const getSKUTemplatesKey = (sku: string | null, organizationId: string | null) => [
  "sku-templates",
  sku,
  organizationId,
];

// Fetch templates for a SKU
const fetchSKUTemplates = async (
  sku: string,
  organizationId: string
): Promise<WorkflowTemplate[]> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_templates")
    .select(`
      id,
      name,
      description,
      is_active,
      completed_count,
      avg_completion_days,
      created_at,
      updated_at,
      workflow_template_stages(
        id,
        name,
        sequence_order,
        depth_level,
        is_leaf_stage,
        location,
        avg_time_hours
      )
    `)
    .eq("sku", sku)
    .eq("organization_id", organizationId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching SKU templates:", error);
    throw new Error(error.message || "Failed to fetch templates");
  }

  // Map the data to include stages properly
  return (data || []).map(template => ({
    ...template,
    stages: template.workflow_template_stages || []
  }));
};

// Hook to fetch SKU templates
export const useSKUTemplates = (
  sku: string | null,
  organizationId: string | null,
  enabled: boolean = true
) => {
  return useQuery<WorkflowTemplate[], Error>({
    queryKey: getSKUTemplatesKey(sku, organizationId),
    queryFn: async () => {
      if (!sku || !organizationId) {
        return [];
      }
      return fetchSKUTemplates(sku, organizationId);
    },
    enabled: enabled && !!sku && !!organizationId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

// Apply a workflow template
const applyWorkflowTemplate = async (
  templateId: string,
  sku: string
): Promise<boolean> => {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('apply_workflow_template', {
    p_template_id: templateId,
    p_sku: sku
  });

  if (error) {
    console.error("Error applying template:", error);
    throw new Error(error.message || "Failed to apply template");
  }

  return true;
};

// Hook to apply a workflow template
export const useApplyTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation<
    boolean,
    Error,
    { templateId: string; sku: string; organizationId: string }
  >({
    mutationFn: async ({ templateId, sku }) => {
      return applyWorkflowTemplate(templateId, sku);
    },
    onSuccess: (_, variables) => {
      toast.success("Workflow template applied successfully");
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["workflow", "structure", variables.organizationId, variables.sku]
      });
      queryClient.invalidateQueries({
        queryKey: getSKUTemplatesKey(variables.sku, variables.organizationId)
      });
      queryClient.invalidateQueries({
        queryKey: ["sku-workflow-state", variables.sku, variables.organizationId]
      });
    },
    onError: (error) => {
      toast.error(`Failed to apply template: ${error.message}`);
    }
  });
};