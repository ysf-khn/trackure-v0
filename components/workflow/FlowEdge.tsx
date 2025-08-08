"use client";

import React from 'react';
import {
  BaseEdge,
  Edge,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react';

export interface FlowEdgeData {
  type?: 'horizontal' | 'vertical' | 'mixed';
  animated?: boolean;
  label?: string;
}

export interface FlowEdgeProps extends EdgeProps {
  data?: FlowEdgeData;
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: FlowEdgeProps) {
  const edgeType = data?.type || 'horizontal';
  const animated = data?.animated || false;
  const label = data?.label;

  // Determine edge path based on type
  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (edgeType === 'horizontal') {
    // Smooth bezier for horizontal main workflow connections
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.25,
    });
  } else if (edgeType === 'vertical') {
    // Smooth step for parent-child vertical connections
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
    });
  } else {
    // Mixed type - use smooth step with larger border radius
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20,
    });
  }

  // Style configuration based on edge type
  const getEdgeStyle = () => {
    const baseStyle = {
      strokeWidth: 2,
      ...style,
    };

    switch (edgeType) {
      case 'horizontal':
        return {
          ...baseStyle,
          stroke: '#3b82f6', // Blue for main workflow
          strokeWidth: 3,
          filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))',
        };
      case 'vertical':
        return {
          ...baseStyle,
          stroke: '#64748b', // Gray for parent-child connections
          strokeWidth: 2,
          strokeDasharray: animated ? '5,5' : undefined,
        };
      case 'mixed':
        return {
          ...baseStyle,
          stroke: '#8b5cf6', // Purple for complex connections
          strokeWidth: 2,
        };
      default:
        return baseStyle;
    }
  };

  const edgeStyle = getEdgeStyle();

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
      />
      
      {/* Edge label if provided */}
      {label && (
        <g>
          <rect
            x={labelX - 25}
            y={labelY - 10}
            width={50}
            height={20}
            fill="white"
            stroke={edgeStyle.stroke}
            strokeWidth={1}
            rx={10}
            ry={10}
            className="drop-shadow-sm"
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            className="text-xs font-medium fill-gray-700"
          >
            {label}
          </text>
        </g>
      )}

      {/* Animated flow indicator for horizontal edges */}
      {animated && edgeType === 'horizontal' && (
        <circle r="3" fill="#3b82f6">
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}
      
      {/* Define the path for animation reference */}
      <defs>
        <path id={id} d={edgePath} />
      </defs>
    </>
  );
}

// Edge type configuration for React Flow
export const flowEdgeTypes = {
  flowEdge: FlowEdge,
};

// Default edge props for different connection types
export const createHorizontalEdge = (
  id: string,
  source: string,
  target: string,
  animated: boolean = true
): Edge => ({
  id,
  source,
  target,
  type: 'flowEdge',
  data: {
    type: 'horizontal',
    animated,
  },
  style: {
    stroke: '#3b82f6',
    strokeWidth: 3,
  },
});

export const createVerticalEdge = (
  id: string,
  source: string,
  target: string,
  label?: string
): Edge => ({
  id,
  source,
  target,
  type: 'flowEdge',
  data: {
    type: 'vertical',
    label,
  },
  style: {
    stroke: '#64748b',
    strokeWidth: 2,
  },
});

export const createMixedEdge = (
  id: string,
  source: string,
  target: string
): Edge => ({
  id,
  source,
  target,
  type: 'flowEdge',
  data: {
    type: 'mixed',
  },
  style: {
    stroke: '#8b5cf6',
    strokeWidth: 2,
  },
});