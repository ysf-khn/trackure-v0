"use client";

import * as React from "react";
import Link from "next/link";
import { Handle, Position } from "@xyflow/react";
import { MapPin, Package, Dot, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

interface StageNodeData {
  stage: FetchedWorkflowStage;
  detailedCount: {
    totalQuantity: number;
    normalQuantity: number;
    reworkedQuantity: number;
  };
  isCurrentStage: boolean;
  level: number; // 0 for main workflow, 1+ for children
  isLoading?: boolean;
  onStageClick?: (stageId: string) => void;
  isDragging?: boolean;
}

interface StageNodeProps {
  data: StageNodeData;
}

export function StageNode({ data }: StageNodeProps) {
  const {
    stage,
    detailedCount,
    isCurrentStage,
    level,
    isLoading = false,
    onStageClick,
    isDragging = false,
  } = data;
  
  // Track if node is being dragged to prevent Link navigation
  const [isNodeDragging, setIsNodeDragging] = React.useState(false);

  const stageName = stage.name || "Unnamed Stage";
  const itemCount = detailedCount.totalQuantity;
  const hasReworked = detailedCount.reworkedQuantity > 0;
  const hasChildren = stage.children && stage.children.length > 0;
  const isLeafStage = stage.is_leaf_stage;
  const isSystemStage = stage.is_system_stage || stageName.toLowerCase().includes("completed");

  // Determine node styling based on level and status
  const getNodeStyling = () => {
    const baseClasses = "relative transition-all duration-200 ease-in-out";

    // System/Completion stage styling
    if (isSystemStage) {
      return {
        className: cn(
          baseClasses,
          isCurrentStage 
            ? "bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 shadow-lg shadow-green-200/50 ring-2 ring-green-300 ring-opacity-50"
            : "bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 shadow-lg hover:shadow-xl hover:shadow-green-200/50"
        ),
        boxShadow: isCurrentStage
          ? "0 8px 25px -5px rgba(34, 197, 94, 0.3), 0 4px 10px -6px rgba(34, 197, 94, 0.3)"
          : "0 6px 20px -5px rgba(34, 197, 94, 0.2), 0 4px 8px -4px rgba(34, 197, 94, 0.2)",
      };
    }

    if (isCurrentStage) {
      return {
        className: cn(
          baseClasses,
          "bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-400 shadow-lg shadow-blue-200/50",
          "ring-2 ring-blue-300 ring-opacity-50" // Use ring instead of transform
        ),
        boxShadow:
          "0 8px 25px -5px rgba(59, 130, 246, 0.3), 0 4px 10px -6px rgba(59, 130, 246, 0.3)",
      };
    }

    if (level === 0) {
      // Main workflow stages - prominent styling without transforms
      return {
        className: cn(
          baseClasses,
          "bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg hover:shadow-xl hover:shadow-gray-300/30"
        ),
        boxShadow:
          "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      };
    } else {
      // Child stages - subtle styling
      return {
        className: cn(
          baseClasses,
          "bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300 shadow-md hover:shadow-lg hover:shadow-gray-200/50"
        ),
        boxShadow:
          "0 4px 12px -2px rgba(0, 0, 0, 0.1), 0 2px 6px -2px rgba(0, 0, 0, 0.05)",
      };
    }
  };

  // Get node size based on level
  const getNodeSize = () => {
    if (level === 0) {
      return { width: 250, height: 100 };
    } else if (level === 1) {
      return { width: 220, height: 85 };
    } else {
      return { width: 200, height: 75 };
    }
  };

  const nodeStyling = getNodeStyling();
  const nodeSize = getNodeSize();


  return (
    <div
      className="group"
      style={{
        width: nodeSize.width,
        height: nodeSize.height,
      }}
      onMouseDown={() => {
        // Start tracking potential drag
        const timeout = setTimeout(() => {
          setIsNodeDragging(true);
        }, 100);
        
        const handleMouseUp = () => {
          clearTimeout(timeout);
          setTimeout(() => setIsNodeDragging(false), 50);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mouseup', handleMouseUp);
      }}
    >
      {/* Connection handles */}
      {/* Main flow target (left) for level 0 nodes */}
      {level === 0 && (
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-gray-400 !border-2 !border-white"
        />
      )}

      {/* Child flow target (top) for all nodes to receive child connections */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-gray-400 !border-2 !border-white"
      />

      {/* Main flow source (right) for level 0 nodes */}
      {level === 0 && (
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-gray-400 !border-2 !border-white"
        />
      )}

      {/* Child flow source (bottom) for nodes that have children */}
      {hasChildren && (
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-gray-400 !border-2 !border-white"
        />
      )}

      {/* Main node content - Link only for leaf nodes */}
      {isLeafStage ? (
        <Link 
          href={`/workflow/${stage.id}`}
          className={cn(
            "block w-full h-full cursor-pointer",
            isNodeDragging && "pointer-events-none" // Disable link during drag
          )}
          prefetch
          onClick={(e) => {
            // Prevent navigation if dragging
            if (isNodeDragging || isDragging) {
              e.preventDefault();
            }
          }}
        >
          <div
            className={cn(
              nodeStyling.className,
              "w-full h-full p-0 rounded-xl border-solid select-none stage-node-content",
              isDragging && "scale-105 shadow-xl shadow-blue-500/30"
            )}
            style={{
              boxShadow: nodeStyling.boxShadow,
            }}
          >
            <div className="flex flex-col w-full h-full justify-between p-4">
          {/* Header with stage info */}
          <div className="flex items-start justify-between w-full">
            <div className="flex-1 min-w-0">
              {/* Stage name */}
              <h3
                className={cn(
                  "font-semibold text-left truncate",
                  level === 0
                    ? "text-base"
                    : level === 1
                      ? "text-sm"
                      : "text-xs",
                  isCurrentStage ? "text-blue-700" : isSystemStage ? "text-green-700" : "text-gray-900"
                )}
              >
                {stageName}
              </h3>

              {/* Location if available */}
              {stage.location && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  <span className="text-xs text-gray-600 truncate">
                    {stage.location}
                  </span>
                </div>
              )}
            </div>

            {/* Stage type indicator */}
            <div className="flex items-center gap-1 ml-2">
              {isSystemStage ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : isLeafStage ? (
                <Dot className="h-4 w-4 text-green-500" />
              ) : hasChildren ? (
                <Package className="h-4 w-4 text-blue-500" />
              ) : (
                <Dot className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Footer with item counts */}
          <div className="flex items-end justify-between w-full">
            {/* SKU badge if available */}
            {stage.sku && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-white/80 border-gray-300"
              >
                {stage.sku}
              </Badge>
            )}

            {/* Item counts */}
            <div className="flex items-center gap-1">
              {isLoading ? (
                <Skeleton className="h-5 w-12 rounded-full" />
              ) : (
                <>
                  {hasReworked ? (
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="default"
                        className="bg-emerald-500 text-white text-xs px-2 py-0.5 font-medium shadow-sm"
                      >
                        {detailedCount.normalQuantity}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 font-medium shadow-sm"
                      >
                        {detailedCount.reworkedQuantity}
                      </Badge>
                    </div>
                  ) : (
                    <Badge
                      variant={itemCount > 0 ? "default" : "secondary"}
                      className={cn(
                        "text-xs px-3 py-1 font-medium shadow-sm",
                        itemCount > 0
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {itemCount > 0 ? `${itemCount}` : "0"}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </Link>
      ) : (
        <div 
          className={cn(
            "block w-full h-full cursor-default",
            "hover:cursor-default" // Indicate non-clickable
          )}
        >
          <div
            className={cn(
              nodeStyling.className,
              "w-full h-full p-0 rounded-xl border-solid select-none stage-node-content",
              isDragging && "scale-105 shadow-xl shadow-blue-500/30",
              // Add visual indication for parent nodes
              !isLeafStage && "ring-1 ring-blue-200/50"
            )}
            style={{
              boxShadow: nodeStyling.boxShadow,
            }}
          >
            <div className="flex flex-col w-full h-full justify-between p-4">
              {/* Header with stage info */}
              <div className="flex items-start justify-between w-full">
                <div className="flex-1 min-w-0">
                  {/* Stage name */}
                  <h3
                    className={cn(
                      "font-semibold text-left truncate",
                      level === 0
                        ? "text-base"
                        : level === 1
                          ? "text-sm"
                          : "text-xs",
                      isCurrentStage ? "text-blue-700" : "text-gray-900"
                    )}
                  >
                    {stageName}
                  </h3>

                  {/* Location if available */}
                  {stage.location && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-gray-600 truncate">
                        {stage.location}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stage type indicator */}
                <div className="flex items-center gap-1 ml-2">
                  {isLeafStage ? (
                    <Dot className="h-4 w-4 text-green-500" />
                  ) : hasChildren ? (
                    <Package className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Dot className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Footer with item counts */}
              <div className="flex items-end justify-between w-full">
                {/* SKU badge if available */}
                {stage.sku && (
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0.5 bg-white/80 border-gray-300"
                  >
                    {stage.sku}
                  </Badge>
                )}

                {/* Item counts */}
                <div className="flex items-center gap-1">
                  {isLoading ? (
                    <Skeleton className="h-5 w-12 rounded-full" />
                  ) : (
                    <>
                      {hasReworked ? (
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="default"
                            className="bg-emerald-500 text-white text-xs px-2 py-0.5 font-medium shadow-sm"
                          >
                            {detailedCount.normalQuantity}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 font-medium shadow-sm"
                          >
                            {detailedCount.reworkedQuantity}
                          </Badge>
                        </div>
                      ) : (
                        <Badge
                          variant={itemCount > 0 ? "default" : "secondary"}
                          className={cn(
                            "text-xs px-3 py-1 font-medium shadow-sm",
                            itemCount > 0
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {itemCount > 0 ? `${itemCount}` : "0"}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover glow effect - positioned to not interfere with dragging */}
      <div
        className={cn(
          "absolute inset-0 rounded-xl opacity-0 pointer-events-none transition-all duration-200 -z-10",
          "group-hover:opacity-100",
          isCurrentStage
            ? "bg-blue-400/10 shadow-lg shadow-blue-400/20"
            : "bg-gray-400/5 shadow-md shadow-gray-400/10"
        )}
      />

      {/* Drag indicator - shows on hover */}
      <div
        className={cn(
          "absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center text-xs font-bold shadow-lg pointer-events-none",
          "group-hover:scale-110 transform"
        )}
      >
        ⋮⋮
      </div>
    </div>
  );
}

// Export the node type configuration
export const stageNodeType = {
  stageNode: StageNode,
};
