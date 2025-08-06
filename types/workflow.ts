// Base type for a workflow stage in the tree structure
export interface WorkflowStage {
  id: string;
  name: string;
  sequence_order: number;
  organization_id: string;
  created_at: string;
  location: string | null;
  parent_stage_id: string | null;
  depth_level: number;
  full_path: string;
  is_leaf_stage: boolean;
  sku: string | null;
  children?: WorkflowStage[]; // For tree structure
}
