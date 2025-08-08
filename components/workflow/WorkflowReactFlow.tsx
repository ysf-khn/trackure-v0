"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  ConnectionMode,
  NodeChange,
  applyNodeChanges,
  Panel,
} from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Import our custom components
import { StageNode, stageNodeType } from "./StageNode";
import { FlowEdge, flowEdgeTypes } from "./FlowEdge";
import { LayoutControls } from "./LayoutControls";
import {
  transformWorkflowToFlow,
  calculateFlowViewport,
  calculateDetailedStageCount,
} from "@/lib/workflow-flow-layout";
import { saveWorkflowLayout } from "@/lib/layout-persistence";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

// Import React Flow styles
import "@xyflow/react/dist/style.css";
import "./WorkflowStyles.css";

interface WorkflowReactFlowProps {
  workflowData: FetchedWorkflowStage[];
  stageCountsData: any;
  isLoadingStageCounts: boolean;
  onStageClick: (stageId: string) => void;
  currentStageId?: string;
  className?: string;
  selectedSKU?: string | null;
}

function WorkflowReactFlowContent({
  workflowData,
  stageCountsData,
  isLoadingStageCounts,
  onStageClick,
  currentStageId,
  className,
  selectedSKU,
}: WorkflowReactFlowProps) {
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow();
  const { organizationId } = useProfileAndOrg();

  // State for managing nodes with drag support
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isCustomLayout, setIsCustomLayout] = useState(false);
  const [forceAutoLayout, setForceAutoLayout] = useState(false);

  // Track if nodes have been dragged to prevent recreation
  const [nodesDragged, setNodesDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Create stable callback for onStageClick to prevent unnecessary recreations
  const stableOnStageClick = useCallback(
    (stageId: string) => {
      onStageClick(stageId);
    },
    [onStageClick]
  );

  // Create initial nodes and edges from workflow data (only when structure changes)
  const initialFlowData = useMemo(() => {
    if (!workflowData || workflowData.length === 0) {
      return { nodes: [], edges: [], isCustomLayout: false };
    }

    return transformWorkflowToFlow(
      workflowData,
      undefined, // Don't include counts in initial creation
      undefined, // Don't include currentStage in initial creation
      organizationId ?? undefined,
      selectedSKU ?? null,
      forceAutoLayout
    );
  }, [workflowData, organizationId, selectedSKU, forceAutoLayout]);

  // Initialize nodes and edges when initial data changes or force reset
  React.useEffect(() => {
    if (initialFlowData.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      setIsCustomLayout(false);
      setNodesDragged(false);
      return;
    }

    // Only recreate nodes if:
    // 1. We have no nodes yet, OR
    // 2. Force auto layout is requested, OR
    // 3. Number of nodes changed (structure changed)
    const shouldRecreateNodes =
      nodes.length === 0 ||
      forceAutoLayout ||
      nodes.length !== initialFlowData.nodes.length;

    if (shouldRecreateNodes) {
      setNodes(initialFlowData.nodes);
      setEdges(initialFlowData.edges);
      setIsCustomLayout(initialFlowData.isCustomLayout);
      setNodesDragged(false);

      // Reset force auto layout flag
      if (forceAutoLayout) {
        setForceAutoLayout(false);
      }
    }
  }, [initialFlowData, forceAutoLayout, nodes.length]);

  // Update node data (counts, current stage, handlers) without recreating nodes
  React.useEffect(() => {
    if (nodes.length === 0 || !stageCountsData) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const detailedCount = stageCountsData?.stageCountsMap
          ? calculateDetailedStageCount(
              node.id,
              workflowData || [],
              stageCountsData.stageCountsMap
            )
          : { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };

        return {
          ...node,
          data: {
            ...node.data,
            detailedCount,
            isCurrentStage: currentStageId === node.id,
            isLoading: isLoadingStageCounts,
            onStageClick: stableOnStageClick,
            isDragging: draggedNodeId === node.id,
          },
        };
      })
    );
  }, [
    stageCountsData,
    currentStageId,
    isLoadingStageCounts,
    stableOnStageClick,
    workflowData,
    draggedNodeId,
  ]);

  // Handle node changes (including drag events)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Track if nodes have been dragged
      const hasDragChange = changes.some(
        (change) => change.type === "position" && !change.dragging
      );
      if (hasDragChange) {
        setNodesDragged(true);
        if (!isCustomLayout) {
          setIsCustomLayout(true);
        }
      }
    },
    [isCustomLayout]
  );

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

  // Fit view to show all nodes
  const handleFitView = useCallback(() => {
    fitView({ padding: 50, duration: 800 });
  }, [fitView]);

  // Reset to center
  const handleResetView = useCallback(() => {
    if (nodes.length > 0) {
      const viewport = calculateFlowViewport(nodes);
      setCenter(viewport.center[0], viewport.center[1], {
        zoom: viewport.zoom,
        duration: 800,
      });
    }
  }, [nodes, setCenter]);

  // Reset to auto layout
  const handleResetToAutoLayout = useCallback(() => {
    setForceAutoLayout(true);
    setIsCustomLayout(false);
  }, []);

  // Handle layout saved callback
  const handleLayoutSaved = useCallback(() => {
    setIsCustomLayout(true);
  }, []);

  // Handle layout reset callback
  const handleLayoutReset = useCallback(() => {
    setIsCustomLayout(false);
  }, []);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!nodes.length) {
      return { totalStages: 0, totalItems: 0, activeStages: 0 };
    }

    const totalStages = nodes.length;
    const totalItems = nodes.reduce((sum, node) => {
      const count =
        ((node.data as any)?.detailedCount?.totalQuantity as
          | number
          | undefined) || 0;
      return sum + count;
    }, 0);
    const activeStages = nodes.filter(
      (node) =>
        (((node.data as any)?.detailedCount?.totalQuantity as
          | number
          | undefined) || 0) > 0
    ).length;

    return { totalStages, totalItems, activeStages };
  }, [nodes]);

  if (!workflowData || workflowData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-xl">
        <p className="text-gray-500">No workflow data available</p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Summary header with layout controls */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Workflow Overview
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">
              {summary.totalStages} stages
            </Badge>
            <Badge variant="outline" className="bg-white">
              {summary.totalItems} items
            </Badge>
            <Badge
              variant={summary.activeStages > 0 ? "default" : "secondary"}
              className={summary.activeStages > 0 ? "bg-emerald-500" : ""}
            >
              {summary.activeStages} active
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Layout controls - Show auto-save indicator when custom layout */}
          {organizationId && (
            <div className="flex items-center gap-2">
              <LayoutControls
                nodes={nodes}
                organizationId={organizationId}
                sku={selectedSKU ?? null}
                isCustomLayout={isCustomLayout}
                onResetToAutoLayout={handleResetToAutoLayout}
                onLayoutSaved={handleLayoutSaved}
                onLayoutReset={handleLayoutReset}
              />
              {isCustomLayout && (
                <Badge variant="outline" className="text-xs">
                  Auto-save enabled
                </Badge>
              )}
            </div>
          )}

          {/* View control buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => zoomOut()}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => zoomIn()}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFitView}
              className="h-8 w-8 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetView}
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* React Flow container */}
      <div className="h-[600px] w-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full space-y-4">
            <div className="space-y-4 w-full max-w-md">
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="flex gap-4">
                <Skeleton className="h-16 flex-1 rounded-lg" />
                <Skeleton className="h-16 flex-1 rounded-lg" />
              </div>
              <Skeleton className="h-12 w-2/3 rounded-lg" />
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
            onNodeDragStart={(_, node) => {
              setIsDragging(true);
              setDraggedNodeId(node.id);
            }}
            onNodeDrag={() => {
              // Keep drag state active
            }}
            onNodeDragStop={() => {
              setIsDragging(false);
              setDraggedNodeId(null);
              
              // Auto-save layout after drag ends with debounce
              if (organizationId) {
                // Clear any existing timer
                if (autoSaveTimer) {
                  clearTimeout(autoSaveTimer);
                }
                
                // Set new timer for auto-save (1 second delay)
                const timer = setTimeout(() => {
                  saveWorkflowLayout(organizationId, selectedSKU ?? null, nodes);
                  console.log('Layout auto-saved after drag');
                }, 1000);
                
                setAutoSaveTimer(timer);
              }
            }}
            connectionMode={ConnectionMode.Strict}
            fitView
            fitViewOptions={{
              padding: 50,
              maxZoom: 1.2,
              minZoom: 0.3,
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            minZoom={0.1}
            maxZoom={2}
            snapToGrid
            snapGrid={[16, 16]}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnScroll
            panOnDrag
            selectionOnDrag={false}
            className="workflow-flow"
            proOptions={{ hideAttribution: true }}
          >
            {/* Background pattern */}
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.1}
              color="#cbd5e1"
            />

            {/* Controls panel */}
            <Controls
              className="!bottom-4 !left-4 !bg-white !border !border-gray-200 !rounded-lg !shadow-lg"
              showFitView={false}
              showInteractive={false}
            />

            {/* Mini map */}
            <MiniMap
              className="!bottom-4 !right-4 !bg-white !border !border-gray-200 !rounded-lg !shadow-lg"
              nodeColor={(node) => {
                if (node.data?.isCurrentStage) return "#3b82f6";
                if (node.data?.level === 0) return "#64748b";
                return "#94a3b8";
              }}
              maskColor="rgba(255, 255, 255, 0.8)"
              pannable
              zoomable
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
                  className="h-8 w-8 p-0"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => zoomIn()}
                  className="h-8 w-8 p-0"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-gray-600 border border-gray-200">
        {currentStageId ? (
          <span className="text-blue-600 font-medium">
            Current:{" "}
            {((nodes.find((n) => n.id === currentStageId)?.data as any)?.stage
              ?.name as string | undefined) || "Unknown"}
          </span>
        ) : (
          "Click any stage to navigate"
        )}
      </div>
    </div>
  );
}

// Main component with ReactFlowProvider
export function WorkflowReactFlow(props: WorkflowReactFlowProps) {
  return (
    <ReactFlowProvider>
      <WorkflowReactFlowContent {...props} />
    </ReactFlowProvider>
  );
}
