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
  Controls,
  MiniMap,
} from "@xyflow/react";
import { Eye, Maximize2, ZoomIn, ZoomOut, Expand, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  const { fitView, setCenter, getNode, zoomIn, zoomOut, getViewport, setViewport } = useReactFlow();
  const { organizationId } = useProfileAndOrg();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenViewport, setFullscreenViewport] = useState<{x: number, y: number, zoom: number} | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const savedViewportRef = React.useRef<{x: number, y: number, zoom: number} | null>(null);
  
  // Refs for ReactFlow instances to avoid context conflicts
  const mainReactFlowRef = React.useRef<any>(null);
  const fullscreenReactFlowRef = React.useRef<any>(null);

  // Transform workflow data to React Flow format
  const flow = useMemo(() => {
    if (!workflowData || workflowData.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Extract SKU from workflow data if available
    const sku = workflowData.find((stage) => stage.sku)?.sku || null;
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

  // Handle entering fullscreen with viewport capture
  const handleEnterFullscreen = useCallback(() => {
    // Capture current viewport state from the main ReactFlow instance
    let currentViewport = { x: 0, y: 0, zoom: 0.9 }; // fallback
    
    try {
      if (mainReactFlowRef.current) {
        currentViewport = mainReactFlowRef.current.getViewport();
      } else {
        // Fallback to useReactFlow hook
        currentViewport = getViewport();
      }
    } catch (error) {
      console.warn('Failed to capture compact viewport, using fallback:', error);
    }
    
    // Store captured viewport for fullscreen and in ref for restoration
    setFullscreenViewport(currentViewport);
    savedViewportRef.current = currentViewport;
    setIsFullscreen(true);
    
    console.log('Entering compact fullscreen with viewport:', currentViewport);
  }, [getViewport]);

  // Handle exiting fullscreen with viewport restore
  const handleExitFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Effect to restore viewport after fullscreen closes
  React.useEffect(() => {
    if (!isFullscreen && savedViewportRef.current) {
      const viewportToRestore = savedViewportRef.current;
      console.log('Starting compact viewport restoration:', viewportToRestore);
      
      // Longer delay to let the dialog fully close and main ReactFlow initialize
      const timer = setTimeout(() => {
        let restored = false;
        
        try {
          // Try to restore using main ReactFlow instance
          if (mainReactFlowRef.current && mainReactFlowRef.current.setViewport) {
            mainReactFlowRef.current.setViewport(viewportToRestore, { duration: 300 });
            restored = true;
            console.log('Compact viewport restored via main instance');
          } else {
            // Fallback to useReactFlow hook
            setViewport(viewportToRestore, { duration: 300 });
            restored = true;
            console.log('Compact viewport restored via hook fallback');
          }
        } catch (error) {
          console.warn('Compact viewport restoration failed, using fitView fallback:', error);
        }
        
        // If restoration failed, use fitView as final fallback
        if (!restored) {
          setTimeout(() => {
            try {
              if (mainReactFlowRef.current && mainReactFlowRef.current.fitView) {
                mainReactFlowRef.current.fitView({ padding: 30, duration: 600 });
                console.log('Used compact fitView fallback via main instance');
              } else {
                fitView({ padding: 30, duration: 600 });
                console.log('Used compact fitView fallback via hook');
              }
            } catch (error) {
              console.error('All compact viewport restoration methods failed:', error);
            }
          }, 100);
        }
        
        savedViewportRef.current = null;
      }, 200); // Increased delay for better reliability
      
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, setViewport, fitView]);

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

  // Handle ESC key to exit fullscreen
  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen) {
        handleExitFullscreen();
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isFullscreen, handleExitFullscreen]);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEnterFullscreen}
            className="h-7 px-2 text-xs"
            title="Fullscreen"
          >
            <Expand className="h-3 w-3 mr-1" />
            Full
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
            onInit={(reactFlowInstance) => {
              mainReactFlowRef.current = reactFlowInstance;
              console.log('Compact main ReactFlow instance initialized');
            }}
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
                  console.log("Compact layout auto-saved after drag");
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

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={(open) => !open && handleExitFullscreen()}>
        <DialogContent className="max-w-none h-screen w-screen p-0 m-0 rounded-none border-none">
          <div className="relative h-full w-full bg-gray-50">
            {/* Close button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitFullscreen}
              className="absolute top-4 right-4 z-50 h-8 w-8 p-0 bg-white shadow-lg"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Fullscreen React Flow */}
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
                  setDraggedNodeId(node.id);
                }}
                onNodeDrag={() => {
                  // Keep drag state active
                }}
                onNodeDragStop={() => {
                  setDraggedNodeId(null);

                  // Auto-save layout after drag ends with debounce
                  if (organizationId) {
                    // Clear any existing timer
                    if (autoSaveTimer) {
                      clearTimeout(autoSaveTimer);
                    }

                    // Set new timer for auto-save (1 second delay)
                    const timer = setTimeout(() => {
                      saveWorkflowLayout(organizationId, selectedSKU, nodes);
                      console.log(
                        "Layout auto-saved after drag in compact fullscreen"
                      );
                    }, 1000);

                    setAutoSaveTimer(timer);
                  }
                }}
                connectionMode={ConnectionMode.Strict}
                defaultViewport={fullscreenViewport || { x: 0, y: 0, zoom: 0.8 }}
                onViewportChange={(viewport) => {
                  // Update fullscreen viewport state as user pans/zooms
                  setFullscreenViewport(viewport);
                }}
                minZoom={0.05}
                maxZoom={3}
                snapToGrid
                snapGrid={[16, 16]}
                nodesDraggable
                nodesConnectable={false}
                elementsSelectable
                panOnScroll
                panOnDrag
                selectionOnDrag={false}
                className="workflow-flow h-full w-full"
                proOptions={{ hideAttribution: true }}
                onInit={(reactFlowInstance) => {
                  fullscreenReactFlowRef.current = reactFlowInstance;
                  console.log('Compact fullscreen ReactFlow instance initialized');
                }}
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

                {/* Fullscreen zoom controls */}
                <Panel
                  position="top-right"
                  className="!bg-white !border !border-gray-200 !rounded-md !shadow px-2 py-1 !top-16"
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFitView}
                      className="h-8 w-8 p-0"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Panel>
              </ReactFlow>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
