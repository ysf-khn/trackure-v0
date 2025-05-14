// Base type for a sub-stage
export interface WorkflowSubStage {
  id: string;
  name: string;
  sequence_order: number;
  stage_id: string;
  organization_id: string;
  created_at: string;
  location: string | null; // Optional location field
}

// Base type for a stage
export interface WorkflowStage {
  id: string;
  name: string;
  sequence_order: number;
  organization_id: string;
  created_at: string;
  location: string | null; // Optional location field
  // Add the nested sub-stages array
  workflow_sub_stages: WorkflowSubStage[];
}

// Type representing a stage with its nested sub-stages
export type WorkflowStageWithSubStages = WorkflowStage & {
  workflow_sub_stages: WorkflowSubStage[];
};
