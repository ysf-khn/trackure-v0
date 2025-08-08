"use client";

import * as React from "react";
import { 
  ArrowRight, 
  RotateCcw, 
  Users, 
  DollarSign, 
  BarChart3,
  Settings,
  Download,
  Upload,
  Zap,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StageWithItems } from "@/hooks/queries/use-multi-stage-items";

interface StageOperationsPanelProps {
  currentStage: StageWithItems;
  allStages: StageWithItems[];
  onBulkMove?: (fromStageId: string, toStageId: string) => void;
  onBulkRework?: (stageId: string) => void;
  onAssignVendor?: (stageId: string) => void;
  onExportData?: (stageId: string) => void;
}

export function StageOperationsPanel({
  currentStage,
  allStages,
  onBulkMove,
  onBulkRework,
  onAssignVendor,
  onExportData,
}: StageOperationsPanelProps) {
  
  const getNextStage = () => {
    const currentIndex = allStages.findIndex(s => s.stage.id === currentStage.stage.id);
    return currentIndex < allStages.length - 1 ? allStages[currentIndex + 1] : null;
  };

  const getPreviousStage = () => {
    const currentIndex = allStages.findIndex(s => s.stage.id === currentStage.stage.id);
    return currentIndex > 0 ? allStages[currentIndex - 1] : null;
  };

  const nextStage = getNextStage();
  const previousStage = getPreviousStage();
  const hasItems = currentStage.items.length > 0;
  const totalItems = currentStage.itemCount;
  const totalQuantity = currentStage.totalQuantity;
  
  // Calculate stage metrics
  const reworkedItems = currentStage.items.filter(item => item.entry_type === 'reworked').length;
  const bottleneckItems = currentStage.items.filter(item => {
    if (!item.current_stage_entered_at) return false;
    const daysDiff = (Date.now() - new Date(item.current_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 7;
  }).length;

  const stageHealthScore = hasItems 
    ? Math.max(0, 100 - (reworkedItems * 20) - (bottleneckItems * 30))
    : 100;

  return (
    <div className="space-y-6">
      {/* Stage Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Stage Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Health score */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Health</span>
              <span className={cn(
                "text-sm font-bold",
                stageHealthScore >= 80 ? "text-green-600" :
                stageHealthScore >= 60 ? "text-yellow-600" : "text-red-600"
              )}>
                {stageHealthScore}%
              </span>
            </div>
            <Progress 
              value={stageHealthScore} 
              className={cn(
                "h-2",
                stageHealthScore >= 80 ? "text-green-600" :
                stageHealthScore >= 60 ? "text-yellow-600" : "text-red-600"
              )}
            />
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold">{totalItems}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
            
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold">{totalQuantity}</div>
              <div className="text-xs text-muted-foreground">Total Quantity</div>
            </div>
          </div>

          {/* Issue indicators */}
          {(reworkedItems > 0 || bottleneckItems > 0) && (
            <div className="space-y-2">
              {reworkedItems > 0 && (
                <div className="flex items-center gap-2 text-orange-600">
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-sm">{reworkedItems} reworked items</span>
                </div>
              )}
              
              {bottleneckItems > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{bottleneckItems} bottlenecked items</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Move operations */}
          {nextStage && hasItems && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    className="w-full justify-start" 
                    onClick={() => onBulkMove?.(currentStage.stage.id, nextStage.stage.id)}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Move all to {nextStage.stage.name}
                    <Badge variant="secondary" className="ml-auto">
                      {totalItems} items
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Move all items from current stage to the next stage
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Rework operations */}
          {previousStage && hasItems && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => onBulkRework?.(currentStage.stage.id)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Send for rework
                    <Badge variant="outline" className="ml-auto">
                      To {previousStage.stage.name}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Send items back for rework to previous stage
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Vendor assignment */}
          {hasItems && currentStage.stage.is_leaf_stage && (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onAssignVendor?.(currentStage.stage.id)}
            >
              <Users className="mr-2 h-4 w-4" />
              Assign Vendor
              <Badge variant="outline" className="ml-auto">
                {totalItems} items
              </Badge>
            </Button>
          )}

          <Separator />

          {/* Data operations */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
            onClick={() => onExportData?.(currentStage.stage.id)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Stage Data
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Items
          </Button>
        </CardContent>
      </Card>

      {/* Stage Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Stage Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stage details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sequence Order:</span>
              <span className="font-medium">{currentStage.stage.sequence_order + 1}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Depth Level:</span>
              <span className="font-medium">{currentStage.stage.depth_level}</span>
            </div>
            
            {currentStage.stage.location && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{currentStage.stage.location}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stage Type:</span>
              <Badge variant={currentStage.stage.is_leaf_stage ? "default" : "secondary"}>
                {currentStage.stage.is_leaf_stage ? "Leaf Stage" : "Parent Stage"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Configuration actions */}
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
              <Settings className="mr-2 h-3 w-3" />
              Edit Stage Settings
            </Button>
            
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
              <DollarSign className="mr-2 h-3 w-3" />
              Configure Vendor Pricing
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Workflow Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {previousStage && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">
                  From: {previousStage.stage.name}
                </span>
                {previousStage.itemCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {previousStage.itemCount} items
                  </Badge>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-medium">
                Current: {currentStage.stage.name}
              </span>
              <Badge variant="default" className="text-xs">
                {currentStage.itemCount} items
              </Badge>
            </div>
            
            {nextStage && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">
                  To: {nextStage.stage.name}
                </span>
                {nextStage.itemCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {nextStage.itemCount} items
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}