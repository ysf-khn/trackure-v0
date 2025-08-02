/**
 * SKU-specific workflow utilities
 * Handles logic for managing per-SKU workflows and templates
 */

import { createClient } from '@/utils/supabase/server';
import { WorkflowStage, buildWorkflowTree, getAllLeafStages } from './workflow-utils';

export interface SKUWorkflowTemplate {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description?: string;
  is_active: boolean;
  completed_count: number;
  avg_completion_days?: number;
  created_at: string;
  stages: WorkflowTemplateStage[];
}

export interface WorkflowTemplateStage {
  id: string;
  template_id: string;
  original_stage_id?: string;
  parent_stage_id?: string;
  name: string;
  sequence_order: number;
  depth_level: number;
  full_path: string;
  is_leaf_stage: boolean;
  location?: string;
  avg_time_hours?: number;
}

export interface SKUWorkflowConfig {
  sku: string;
  organization_id: string;
  workflow_type: 'organization' | 'sku';
  stages: WorkflowStage[];
  has_custom_workflow: boolean;
  template_used?: string;
}

/**
 * Determines the workflow configuration for a specific SKU
 */
export async function getSKUWorkflowConfig(
  sku: string, 
  organizationId: string
): Promise<SKUWorkflowConfig> {
  const supabase = await createClient();
  
  // First check if SKU has its own specific workflow
  const { data: skuStages, error: skuError } = await supabase
    .from('workflow_stages')
    .select(`
      id,
      name,
      parent_stage_id,
      depth_level,
      full_path,
      sequence_order,
      is_leaf_stage,
      location,
      sku
    `)
    .eq('organization_id', organizationId)
    .eq('sku', sku)
    .order('sequence_order');

  if (!skuError && skuStages && skuStages.length > 0) {
    // SKU has its own workflow
    return {
      sku,
      organization_id: organizationId,
      workflow_type: 'sku',
      stages: skuStages as WorkflowStage[],
      has_custom_workflow: true
    };
  }

  // Fallback to organization-wide workflow
  const { data: orgStages, error: orgError } = await supabase
    .from('workflow_stages')
    .select(`
      id,
      name,
      parent_stage_id,
      depth_level,
      full_path,
      sequence_order,
      is_leaf_stage,
      location,
      sku
    `)
    .eq('organization_id', organizationId)
    .is('sku', null)
    .order('sequence_order');

  if (orgError) {
    throw new Error(`Failed to fetch workflow for SKU ${sku}: ${orgError.message}`);
  }

  return {
    sku,
    organization_id: organizationId,
    workflow_type: 'organization',
    stages: orgStages as WorkflowStage[] || [],
    has_custom_workflow: false
  };
}

/**
 * Creates a SKU-specific workflow from a template
 */
export async function createSKUWorkflowFromTemplate(
  templateId: string,
  sku: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Call the database function to apply template
    const { data, error } = await supabase.rpc('apply_workflow_template', {
      p_template_id: templateId,
      p_sku: sku
    });

    if (error) {
      console.error('Error applying workflow template:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Error creating SKU workflow from template:', error);
    return false;
  }
}

/**
 * Creates a template from a successfully completed SKU workflow
 */
export async function createTemplateFromCompletedSKU(
  sku: string,
  organizationId: string,
  templateName: string,
  description?: string
): Promise<string | null> {
  const supabase = await createClient();
  
  try {
    // Call the database function to create template
    const { data, error } = await supabase.rpc('create_workflow_template_from_completed', {
      p_sku: sku,
      p_organization_id: organizationId,
      p_name: templateName,
      p_description: description
    });

    if (error) {
      console.error('Error creating template from completed SKU:', error);
      return null;
    }

    return data; // Returns template ID
  } catch (error) {
    console.error('Error creating template:', error);
    return null;
  }
}

/**
 * Gets all available workflow templates for an organization
 */
export async function getWorkflowTemplates(
  organizationId: string
): Promise<SKUWorkflowTemplate[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('workflow_templates')
    .select(`
      *,
      stages:workflow_template_stages(*)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching workflow templates:', error);
    return [];
  }

  return data as SKUWorkflowTemplate[];
}

/**
 * Clones a workflow from one SKU to another
 */
export async function cloneSKUWorkflow(
  sourceSKU: string,
  targetSKU: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Get source workflow stages
    const sourceConfig = await getSKUWorkflowConfig(sourceSKU, organizationId);
    
    if (!sourceConfig.has_custom_workflow) {
      throw new Error('Source SKU does not have a custom workflow to clone');
    }

    // Delete any existing workflow for target SKU
    await supabase
      .from('workflow_stages')
      .delete()
      .eq('organization_id', organizationId)
      .eq('sku', targetSKU);

    // Clone stages with new IDs
    const stageMapping = new Map<string, string>();
    
    // First pass: create root stages and build mapping
    for (const stage of sourceConfig.stages.filter(s => !s.parent_stage_id)) {
      const { data: newStage, error } = await supabase
        .from('workflow_stages')
        .insert({
          organization_id: organizationId,
          sku: targetSKU,
          parent_stage_id: null,
          name: stage.name,
          sequence_order: stage.sequence_order,
          depth_level: stage.depth_level,
          full_path: stage.full_path,
          is_leaf_stage: stage.is_leaf_stage,
          location: stage.location
        })
        .select('id')
        .single();

      if (error) throw error;
      stageMapping.set(stage.id, newStage.id);
    }

    // Second pass: create child stages
    const remainingStages = sourceConfig.stages.filter(s => s.parent_stage_id);
    let maxDepth = Math.max(...remainingStages.map(s => s.depth_level));
    
    for (let depth = 1; depth <= maxDepth; depth++) {
      const stagesAtDepth = remainingStages.filter(s => s.depth_level === depth);
      
      for (const stage of stagesAtDepth) {
        const parentId = stageMapping.get(stage.parent_stage_id!);
        if (!parentId) continue;

        const { data: newStage, error } = await supabase
          .from('workflow_stages')
          .insert({
            organization_id: organizationId,
            sku: targetSKU,
            parent_stage_id: parentId,
            name: stage.name,
            sequence_order: stage.sequence_order,
            depth_level: stage.depth_level,
            full_path: stage.full_path.replace(sourceSKU, targetSKU),
            is_leaf_stage: stage.is_leaf_stage,
            location: stage.location
          })
          .select('id')
          .single();

        if (error) throw error;
        stageMapping.set(stage.id, newStage.id);
      }
    }

    return true;
  } catch (error) {
    console.error('Error cloning SKU workflow:', error);
    return false;
  }
}

/**
 * Validates that a SKU workflow is complete and valid
 */
export async function validateSKUWorkflow(
  sku: string,
  organizationId: string
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const config = await getSKUWorkflowConfig(sku, organizationId);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if workflow exists
  if (!config.stages || config.stages.length === 0) {
    errors.push('No workflow stages found for this SKU');
    return { isValid: false, errors, warnings };
  }

  // Build tree and validate structure
  const tree = buildWorkflowTree(config.stages);
  const leafStages = getAllLeafStages(tree);

  // Check for at least one leaf stage
  if (leafStages.length === 0) {
    errors.push('Workflow has no leaf stages (stages where items can be allocated)');
  }

  // Check for gaps in sequence order
  const allSequenceOrders = config.stages.map(s => s.sequence_order).sort((a, b) => a - b);
  for (let i = 1; i < allSequenceOrders.length; i++) {
    if (allSequenceOrders[i] - allSequenceOrders[i-1] > 1) {
      warnings.push(`Gap in sequence order between ${allSequenceOrders[i-1]} and ${allSequenceOrders[i]}`);
    }
  }

  // Check for orphaned stages (stages with parent_stage_id that doesn't exist)
  for (const stage of config.stages) {
    if (stage.parent_stage_id) {
      const parentExists = config.stages.some(s => s.id === stage.parent_stage_id);
      if (!parentExists) {
        errors.push(`Stage "${stage.name}" has invalid parent_stage_id: ${stage.parent_stage_id}`);
      }
    }
  }

  // Check for completed stage
  const hasCompletedStage = config.stages.some(s => s.name.toLowerCase() === 'completed');
  if (!hasCompletedStage) {
    warnings.push('No "Completed" stage found in workflow');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gets workflow performance metrics for a SKU
 */
export async function getSKUWorkflowMetrics(
  sku: string,
  organizationId: string
): Promise<{
  total_items_processed: number;
  avg_completion_days: number;
  bottleneck_stages: Array<{
    stage_id: string;
    stage_name: string;
    avg_time_days: number;
    items_count: number;
  }>;
}> {
  const supabase = await createClient();
  
  // Get items that have been through this workflow
  const { data: items, error } = await supabase
    .from('items')
    .select(`
      id,
      created_at,
      movement_history:item_movement_history(
        id,
        from_stage_id,
        to_stage_id,
        moved_at,
        from_stage:workflow_stages!item_movement_history_from_stage_id_fkey(name),
        to_stage:workflow_stages!item_movement_history_to_stage_id_fkey(name)
      )
    `)
    .eq('sku', sku)
    .eq('organization_id', organizationId);

  if (error) {
    console.error('Error fetching SKU workflow metrics:', error);
    return {
      total_items_processed: 0,
      avg_completion_days: 0,
      bottleneck_stages: []
    };
  }

  // Calculate metrics
  const completedItems = items.filter(item => 
    item.movement_history.some((m: any) => m.to_stage?.name === 'Completed')
  );

  const avgCompletionDays = completedItems.length > 0 
    ? completedItems.reduce((sum, item) => {
        const completedMovement = item.movement_history.find((m: any) => m.to_stage?.name === 'Completed');
        if (completedMovement) {
          const days = (new Date(completedMovement.moved_at).getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }
        return sum;
      }, 0) / completedItems.length
    : 0;

  // Calculate bottleneck stages (stages where items spend the most time)
  const stageMetrics = new Map<string, { name: string; totalTime: number; count: number }>();
  
  items.forEach(item => {
    const movements = item.movement_history.sort((a: any, b: any) => 
      new Date(a.moved_at).getTime() - new Date(b.moved_at).getTime()
    );
    
    for (let i = 0; i < movements.length - 1; i++) {
      const currentMovement = movements[i];
      const nextMovement = movements[i + 1];
      const stageId = currentMovement.to_stage_id;
      const stageName = currentMovement.to_stage?.name || 'Unknown';
      
      if (stageId) {
        const timeInStage = (new Date(nextMovement.moved_at).getTime() - new Date(currentMovement.moved_at).getTime()) / (1000 * 60 * 60 * 24);
        
        if (!stageMetrics.has(stageId)) {
          stageMetrics.set(stageId, { name: stageName, totalTime: 0, count: 0 });
        }
        
        const metrics = stageMetrics.get(stageId)!;
        metrics.totalTime += timeInStage;
        metrics.count += 1;
      }
    }
  });

  const bottleneckStages = Array.from(stageMetrics.entries())
    .map(([stageId, metrics]) => ({
      stage_id: stageId,
      stage_name: metrics.name,
      avg_time_days: metrics.totalTime / metrics.count,
      items_count: metrics.count
    }))
    .sort((a, b) => b.avg_time_days - a.avg_time_days)
    .slice(0, 5); // Top 5 bottlenecks

  return {
    total_items_processed: items.length,
    avg_completion_days: avgCompletionDays,
    bottleneck_stages: bottleneckStages
  };
}