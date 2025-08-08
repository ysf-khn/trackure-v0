"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  ConnectionMode,
  NodeChange,
  applyNodeChanges,
  Panel,
} from "@xyflow/react";
import { Eye, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Import our custom components
import { StageNode, stageNodeType } from "./StageNode";
import { FlowEdge, flowEdgeTypes } from "./FlowEdge";
import { transformWorkflowToFlow } from "@/lib/workflow-flow-layout";
import { saveWorkflowLayout } from "@/lib/layout-persistence";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

// Import React Flow styles
import "@xyflow/react/dist/style.css";

interface WorkflowReactFlowCompactProps {
  workflowData: FetchedWorkflowStage[];
  stageCountsData: any;
  isLoadingStageCounts: boolean;
  onStageClick: (stageId: string) => void;
  currentStageId?: string;
  className?: string;
  height?: string;
}

// Data stored on each stage node
interface StageNodeData {
  [key: string]: unknown;
  stage?: { id?: string; name?: string | null } | null;
  onStageClick: (stageId: string) => void;
  isLoading: boolean;
  detailedCount?: { totalQuantity?: number } | null;
  level?: number;
  isCurrentStage?: boolean;
}

function WorkflowReactFlowCompactContent({
  workflowData,
  stageCountsData,
  isLoadingStageCounts,
  onStageClick,
  currentStageId,
  className,
  height = "h-80",
}: WorkflowReactFlowCompactProps) {
  const { fitView, setCenter, getNode, zoomIn, zoomOut } = useReactFlow();
  const { organizationId } = useProfileAndOrg();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);

  // Transform workflow data to React Flow format
  const flow = useMemo(() => {
    if (!workflowData || workflowData.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Extract SKU from workflow data if available
    const sku = workflowData.find(stage => stage.sku)?.sku || null;
    setSelectedSKU(sku);

    const flowData = transformWorkflowToFlow(
      workflowData,
      stageCountsData,
      currentStageId,
      organizationId || undefined,
      sku
    );

    // Add onStageClick handler to all nodes and make them smaller for compact view
    const nodesWithHandlers = flowData.nodes.map((node: Node) => ({
      ...node,
      data: {
        ...node.data,
        onStageClick,
        isLoading: isLoadingStageCounts,
      },
      // Make nodes smaller for compact view
      style: {
        ...node.style,
        width:
          node.data?.level === 0 ? 200 : node.data?.level === 1 ? 180 : 160,
        height: node.data?.level === 0 ? 80 : node.data?.level === 1 ? 70 : 60,
      },
    }));

    return {
      nodes: nodesWithHandlers,
      edges: flowData.edges,
    };
  }, [
    workflowData,
    stageCountsData,
    isLoadingStageCounts,
    onStageClick,
    currentStageId,
  ]);

  // Initialize/refresh state when flow changes
  React.useEffect(() => {
    setNodes(flow.nodes as Node[]);
    setEdges(flow.edges as Edge[]);
  }, [flow.nodes, flow.edges]);

  // Handle node click
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const id = (node.data as any)?.stage?.id as string | undefined;
      if (id) {
        onStageClick(id);
      }
    },
    [onStageClick]
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Fit view to show all nodes
  const handleFitView = useCallback(() => {
    fitView({ padding: 30, duration: 600 });
  }, [fitView]);

  // Focus on current stage
  const handleFocusCurrentStage = useCallback(() => {
    if (!currentStageId) return;
    const node = getNode(currentStageId);
    if (!node) return;
    const x = node.position.x + (node.width ? node.width / 2 : 0);
    const y = node.position.y + (node.height ? node.height / 2 : 0);
    setCenter(x, y, { duration: 600, zoom: 1.0 });
  }, [currentStageId, getNode, setCenter]);

  // Get current stage name for display
  const currentStageName = useMemo(() => {
    if (!currentStageId || !nodes.length) return null;
    const currentNode = nodes.find((node) => node.id === currentStageId);
    return (
      ((currentNode?.data as any)?.stage?.name as string | undefined) ?? null
    );
  }, [currentStageId, nodes]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  if (!workflowData || workflowData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">No workflow data available</p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Compact header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-medium text-gray-700">
            Workflow Navigation
          </h4>
          {currentStageName && (
            <Badge variant="default" className="bg-blue-500 text-white text-xs">
              {currentStageName}
            </Badge>
          )}
        </div>

        {/* Compact controls */}
        <div className="flex items-center gap-1">
          {currentStageId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFocusCurrentStage}
              className="h-7 px-2 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Focus
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitView}
            className="h-7 px-2 text-xs"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Fit
          </Button>
        </div>
      </div>

      {/* Compact React Flow container */}
      <div
        className={cn(
          height,
          "w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 overflow-hidden"
        )}
      >
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full space-y-2">
            <div className="space-y-2 w-full max-w-xs px-4">
              <Skeleton className="h-12 w-full rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded" />
                <Skeleton className="h-10 flex-1 rounded" />
              </div>
              <Skeleton className="h-8 w-2/3 rounded" />
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={stageNodeType}
            edgeTypes={flowEdgeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            connectionMode={ConnectionMode.Strict}
            fitView
            fitViewOptions={{
              padding: 30,
              maxZoom: 1.5,
              minZoom: 0.4,
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
            minZoom={0.2}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnScroll
            selectionOnDrag={false}
            panOnDrag
            zoomOnScroll={false}
            className="compact-workflow-flow"
            proOptions={{ hideAttribution: true }}
            onNodeDragStop={() => {
              // Auto-save layout after drag ends with debounce
              if (organizationId) {
                // Clear any existing timer
                if (autoSaveTimer) {
                  clearTimeout(autoSaveTimer);
                }
                
                // Set new timer for auto-save (1 second delay)
                const timer = setTimeout(() => {
                  saveWorkflowLayout(organizationId, selectedSKU, nodes);
                  console.log('Compact layout auto-saved after drag');
                }, 1000);
                
                setAutoSaveTimer(timer);
              }
            }}
          >
            {/* Subtle background */}
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={0.7}
              color="#111111"
            />

            {/* In-canvas zoom controls */}
            <Panel
              position="top-right"
              className="!bg-white !border !border-gray-200 !rounded-md !shadow px-2 py-1"
            >
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => zoomOut()}
                  className="h-7 w-7 p-0 text-black"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => zoomIn()}
                  className="h-7 w-7 p-0 text-black"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* Compact status footer */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 px-2">
        <span>
          {nodes.length} stages •{" "}
          {
            nodes.filter(
              (n) =>
                (((n.data as any)?.detailedCount?.totalQuantity as
                  | number
                  | undefined) || 0) > 0
            ).length
          }{" "}
          active
        </span>
        <span className="text-blue-600">Click stage to navigate</span>
      </div>
    </div>
  );
}

// Main compact component with ReactFlowProvider
export function WorkflowReactFlowCompact(props: WorkflowReactFlowCompactProps) {
  return (
    <ReactFlowProvider>
      <WorkflowReactFlowCompactContent {...props} />
    </ReactFlowProvider>
  );
}
