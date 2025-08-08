"use client";

import * as React from "react";
import { useState } from "react";
import { Save, RotateCcw, Grid3X3, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { 
  saveWorkflowLayout, 
  deleteWorkflowLayout, 
  getLayoutMetadata,
  type LayoutMetadata 
} from "@/lib/layout-persistence";
import type { Node } from '@xyflow/react';

interface LayoutControlsProps {
  nodes: Node[];
  organizationId: string;
  sku: string | null;
  isCustomLayout: boolean;
  onResetToAutoLayout: () => void;
  onLayoutSaved?: () => void;
  onLayoutReset?: () => void;
  className?: string;
}

export function LayoutControls({
  nodes,
  organizationId,
  sku,
  isCustomLayout,
  onResetToAutoLayout,
  onLayoutSaved,
  onLayoutReset,
  className,
}: LayoutControlsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'success' | 'error' | null>(null);
  const [layoutMetadata, setLayoutMetadata] = useState<LayoutMetadata>(() => 
    getLayoutMetadata(organizationId, sku, nodes)
  );

  // Update metadata when nodes change
  React.useEffect(() => {
    const metadata = getLayoutMetadata(organizationId, sku, nodes);
    setLayoutMetadata(metadata);
  }, [nodes, organizationId, sku]);

  // Handle save layout
  const handleSaveLayout = async () => {
    if (nodes.length === 0) return;

    setIsSaving(true);
    setLastSaveStatus(null);

    try {
      const success = saveWorkflowLayout(organizationId, sku, nodes);
      
      if (success) {
        setLastSaveStatus('success');
        setLayoutMetadata(prev => ({
          ...prev,
          isCustomLayout: true,
          lastSaved: Date.now(),
          hasUnsavedChanges: false,
        }));
        onLayoutSaved?.();
        
        // Clear success status after 3 seconds
        setTimeout(() => setLastSaveStatus(null), 3000);
      } else {
        setLastSaveStatus('error');
        setTimeout(() => setLastSaveStatus(null), 5000);
      }
    } catch (error) {
      setLastSaveStatus('error');
      console.error('Failed to save layout:', error);
      setTimeout(() => setLastSaveStatus(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset to auto layout
  const handleResetLayout = async () => {
    try {
      const success = deleteWorkflowLayout(organizationId, sku);
      if (success) {
        setLayoutMetadata(prev => ({
          ...prev,
          isCustomLayout: false,
          lastSaved: null,
          hasUnsavedChanges: false,
        }));
        onLayoutReset?.();
        onResetToAutoLayout();
      }
    } catch (error) {
      console.error('Failed to reset layout:', error);
    }
  };

  // Format timestamp for display
  const formatLastSaved = (timestamp: number) => {
    const now = Date.now();
    const diffMinutes = Math.floor((now - timestamp) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Layout status indicator */}
        <div className="flex items-center gap-2">
          {isCustomLayout ? (
            <Badge 
              variant="default" 
              className="bg-blue-500 text-white text-xs px-2 py-1"
            >
              <Grid3X3 className="h-3 w-3 mr-1" />
              Custom Layout
            </Badge>
          ) : (
            <Badge 
              variant="outline" 
              className="text-xs px-2 py-1"
            >
              Auto Layout
            </Badge>
          )}

          {/* Unsaved changes indicator */}
          {layoutMetadata.hasUnsavedChanges && (
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant="secondary" 
                  className="bg-amber-100 text-amber-800 text-xs px-2 py-1"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Unsaved
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                You have unsaved layout changes
              </TooltipContent>
            </Tooltip>
          )}

          {/* Last saved indicator */}
          {layoutMetadata.lastSaved && !layoutMetadata.hasUnsavedChanges && (
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant="outline" 
                  className="text-xs px-2 py-1 text-green-700 border-green-200"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {formatLastSaved(layoutMetadata.lastSaved)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Layout saved {formatLastSaved(layoutMetadata.lastSaved)}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-1">
          {/* Save button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveLayout}
                disabled={isSaving || nodes.length === 0}
                className={cn(
                  "h-8 px-3",
                  lastSaveStatus === 'success' && "border-green-500 bg-green-50",
                  lastSaveStatus === 'error' && "border-red-500 bg-red-50"
                )}
              >
                {lastSaveStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Save className={cn(
                    "h-4 w-4",
                    isSaving && "animate-pulse",
                    lastSaveStatus === 'error' && "text-red-600"
                  )} />
                )}
                <span className="ml-1 text-xs">
                  {isSaving ? 'Saving...' : 
                   lastSaveStatus === 'success' ? 'Saved!' :
                   lastSaveStatus === 'error' ? 'Failed' : 'Save Layout'}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Save current node positions to your browser
            </TooltipContent>
          </Tooltip>

          {/* Reset button */}
          {isCustomLayout && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetLayout}
                  className="h-8 px-3"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="ml-1 text-xs">Reset</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Reset to automatic layout positioning
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}