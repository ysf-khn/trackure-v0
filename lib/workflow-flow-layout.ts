import type { Node, Edge } from "@xyflow/react";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";
import { loadWorkflowLayout, type SavedLayout } from "./layout-persistence";

// Constants for layout spacing
const HORIZONTAL_SPACING = 350; // Space between main workflow stages
const VERTICAL_SPACING = 180; // Space between parent and child levels
const SIBLING_SPACING = 240; // Space between sibling child nodes
const NODE_WIDTH = 280;
const NODE_HEIGHT = 120;

// Interface for positioned stage with layout metadata
interface PositionedStage extends FetchedWorkflowStage {
  x: number;
  y: number;
  level: number; // 0 for main workflow, 1+ for children
  parentX?: number; // X position of parent for child positioning
}

/**
 * Transform tree structure workflow data into React Flow nodes and edges
 * with horizontal main flow and vertical child extension layout
 * Supports loading custom saved positions
 */
export function transformWorkflowToFlow(
  workflowData: FetchedWorkflowStage[],
  stageCountsData?: any,
  currentStageId?: string,
  organizationId?: string,
  sku?: string | null,
  forceAutoLayout?: boolean
): { nodes: Node[]; edges: Edge[]; isCustomLayout: boolean } {
  if (!workflowData || workflowData.length === 0) {
    return { nodes: [], edges: [], isCustomLayout: false };
  }

  // Load saved layout if available
  let savedLayout: SavedLayout | null = null;
  if (!forceAutoLayout && organizationId) {
    savedLayout = loadWorkflowLayout(organizationId, sku || null);
  }

  // Step 1: Calculate positions for all stages
  const positionedStages: PositionedStage[] = [];
  const edges: Edge[] = [];

  // Process main workflow stages (level 0) - horizontal layout
  let mainStageIndex = 0;
  workflowData.forEach((stage) => {
    const positionedStage: PositionedStage = {
      ...stage,
      x: mainStageIndex * HORIZONTAL_SPACING,
      y: 0,
      level: 0,
    };
    positionedStages.push(positionedStage);

    // Process children recursively - vertical layout
    if (stage.children && stage.children.length > 0) {
      processChildStages(
        stage.children,
        positionedStage.x, // Parent X position
        VERTICAL_SPACING, // First child Y position
        1, // Child level
        positionedStages,
        edges,
        stage.id // Parent ID for edge creation
      );
    }

    // Create horizontal edges between main stages
    if (mainStageIndex > 0) {
      const previousStage = workflowData[mainStageIndex - 1];
      edges.push({
        id: `${previousStage.id}-${stage.id}`,
        source: previousStage.id,
        target: stage.id,
        type: "flowEdge",
        sourceHandle: "right",
        targetHandle: "left",
        data: {
          type: "horizontal",
          animated: true,
        },
        style: {
          stroke: "#3b82f6",
          strokeWidth: 3,
        },
      });
    }

    mainStageIndex++;
  });

  // Step 2: Convert positioned stages to React Flow nodes
  const nodes: Node[] = positionedStages.map((stage) => {
    const detailedCount = stageCountsData?.stageCountsMap
      ? calculateDetailedStageCount(
          stage.id,
          workflowData,
          stageCountsData.stageCountsMap
        )
      : { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };

    // Use saved position if available, otherwise use calculated position
    let finalPosition = { x: stage.x, y: stage.y };
    if (savedLayout?.positions[stage.id]) {
      finalPosition = savedLayout.positions[stage.id];
    }

    return {
      id: stage.id,
      type: "stageNode",
      position: finalPosition,
      data: {
        stage,
        detailedCount,
        isCurrentStage: currentStageId === stage.id,
        level: stage.level,
      },
      // Entire node is draggable (no dragHandle restriction)
    };
  });

  return {
    nodes,
    edges,
    isCustomLayout: savedLayout?.layoutType === "custom" || false,
  };
}

/**
 * Recursively process child stages with vertical positioning
 */
function processChildStages(
  children: FetchedWorkflowStage[],
  parentX: number,
  baseY: number,
  level: number,
  positionedStages: PositionedStage[],
  edges: Edge[],
  parentId: string
): void {
  children.forEach((child, index) => {
    // Position children vertically below parent
    // Distribute siblings horizontally around parent X position
    const siblingOffset = (index - (children.length - 1) / 2) * SIBLING_SPACING;
    const childX = parentX + siblingOffset;
    const childY = baseY;

    const positionedChild: PositionedStage = {
      ...child,
      x: childX,
      y: childY,
      level,
      parentX,
    };
    positionedStages.push(positionedChild);

    // Create edge from parent to child
    edges.push({
      id: `${parentId}-${child.id}`,
      source: parentId,
      target: child.id,
      type: "flowEdge",
      sourceHandle: "bottom",
      targetHandle: "top",
      data: {
        type: "vertical",
      },
      style: {
        stroke: "#94a3b8",
        strokeWidth: 2,
      },
    });

    // Process grandchildren recursively
    if (child.children && child.children.length > 0) {
      processChildStages(
        child.children,
        childX, // New parent X
        childY + VERTICAL_SPACING, // Deeper Y level
        level + 1, // Increment level
        positionedStages,
        edges,
        child.id // New parent ID
      );
    }
  });
}

/**
 * Calculate detailed stage count (copied from use-stage-item-counts)
 * This is needed for the layout utility to work independently
 */
export function calculateDetailedStageCount(
  stageId: string,
  workflowData: FetchedWorkflowStage[],
  stageCountsMap: Map<string, any> | Record<string, any>
): { totalQuantity: number; normalQuantity: number; reworkedQuantity: number } {
  // For parent nodes, we need to aggregate from children
  // Find the stage in the workflow tree
  const findStageInTree = (
    stages: FetchedWorkflowStage[],
    targetId: string
  ): FetchedWorkflowStage | null => {
    for (const stage of stages) {
      if (stage.id === targetId) {
        return stage;
      }
      if (stage.children && stage.children.length > 0) {
        const found = findStageInTree(stage.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const stage = findStageInTree(workflowData, stageId);
  if (!stage) {
    return { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
  }

  // If this is a leaf stage, return its direct count
  if (stage.is_leaf_stage || !stage.children || stage.children.length === 0) {
    // Handle both Map and plain object
    const stageCount = stageCountsMap instanceof Map 
      ? stageCountsMap.get(stageId)
      : stageCountsMap[stageId];
      
    if (!stageCount) {
      return { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
    }

    // Use the correct property names from the Map
    const normalQuantity = stageCount.normalQuantity || 0;
    const reworkedQuantity = stageCount.reworkedQuantity || 0;
    const totalQuantity = stageCount.totalQuantity || 0;

    return {
      totalQuantity,
      normalQuantity,
      reworkedQuantity,
    };
  }

  // For parent nodes, aggregate all child counts
  const collectAllChildStageIds = (stage: FetchedWorkflowStage): string[] => {
    const ids: string[] = [];
    if (stage.children && stage.children.length > 0) {
      stage.children.forEach((childStage) => {
        ids.push(childStage.id);
        ids.push(...collectAllChildStageIds(childStage));
      });
    }
    return ids;
  };

  const allChildStageIds = collectAllChildStageIds(stage);
  let totalQuantity = 0;
  let normalQuantity = 0;
  let reworkedQuantity = 0;

  allChildStageIds.forEach((childId) => {
    // Handle both Map and plain object
    const stageCount = stageCountsMap instanceof Map 
      ? stageCountsMap.get(childId)
      : stageCountsMap[childId];
      
    if (stageCount) {
      // Use the correct property names from the Map
      totalQuantity += stageCount.totalQuantity || 0;
      normalQuantity += stageCount.normalQuantity || 0;
      reworkedQuantity += stageCount.reworkedQuantity || 0;
    }
  });

  return {
    totalQuantity,
    normalQuantity,
    reworkedQuantity,
  };
}

/**
 * Calculate optimal viewport settings for the workflow
 */
export function calculateFlowViewport(nodes: Node[]): {
  center: [number, number];
  zoom: number;
} {
  if (nodes.length === 0) {
    return { center: [0, 0], zoom: 1 };
  }

  // Find bounds of all nodes
  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position.x),
      maxX: Math.max(acc.maxX, node.position.x + NODE_WIDTH),
      minY: Math.min(acc.minY, node.position.y),
      maxY: Math.max(acc.maxY, node.position.y + NODE_HEIGHT),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  // Calculate center point
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  // Calculate zoom to fit (assuming viewport dimensions)
  const width = bounds.maxX - bounds.minX + 100; // Add padding
  const height = bounds.maxY - bounds.minY + 100; // Add padding
  const zoom = Math.min(800 / width, 600 / height, 1); // Max zoom of 1

  return {
    center: [centerX, centerY],
    zoom: Math.max(zoom, 0.1), // Minimum zoom of 0.1
  };
}
