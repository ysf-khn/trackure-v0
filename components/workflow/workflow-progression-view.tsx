"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Package, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { StageWithItems } from "@/hooks/queries/use-multi-stage-items";
import { DenseItemCards } from "./dense-item-cards";

interface WorkflowProgressionViewProps {
  allStages: StageWithItems[];
  currentStageId: string;
  onStageClick?: (stageId: string) => void;
}

export function WorkflowProgressionView({
  allStages,
  currentStageId,
  onStageClick,
}: WorkflowProgressionViewProps) {
  const [expandedStages, setExpandedStages] = React.useState<Record<string, boolean>>(() => {
    // Auto-expand current stage and stages with items
    const initial: Record<string, boolean> = {};
    allStages.forEach(stageData => {
      initial[stageData.stage.id] = 
        stageData.stage.id === currentStageId || stageData.items.length > 0;
    });
    return initial;
  });

  const toggleStageExpansion = (stageId: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  const getTotalItemsAndQuantity = () => {
    const totals = allStages.reduce(
      (acc, stageData) => ({
        items: acc.items + stageData.itemCount,
        quantity: acc.quantity + stageData.totalQuantity
      }),
      { items: 0, quantity: 0 }
    );
    return totals;
  };

  const totals = getTotalItemsAndQuantity();

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Workflow Progression Overview
            </CardTitle>
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                {totals.items} total items
              </Badge>
              <Badge variant="outline">
                {totals.quantity} total quantity
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stage progression */}
      <div className="space-y-4">
        {allStages.map((stageData, index) => {
          const { stage, items, itemCount, totalQuantity } = stageData;
          const isCurrent = stage.id === currentStageId;
          const isExpanded = expandedStages[stage.id];
          const hasItems = items.length > 0;
          
          return (
            <div key={stage.id} className="relative">
              {/* Connection line to next stage */}
              {index < allStages.length - 1 && (
                <div className="absolute left-6 top-16 w-px h-6 bg-border z-0" />
              )}
              
              <Collapsible open={isExpanded} onOpenChange={() => toggleStageExpansion(stage.id)}>
                <Card className={cn(
                  "transition-all duration-200 relative z-10",
                  isCurrent && "ring-2 ring-primary shadow-lg",
                  hasItems && !isCurrent && "shadow-sm hover:shadow-md"
                )}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      isCurrent && "bg-primary/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Stage indicator */}
                          <div className={cn(
                            "w-3 h-3 rounded-full border-2 flex-shrink-0",
                            isCurrent 
                              ? "bg-primary border-primary" 
                              : hasItems 
                                ? "bg-background border-primary" 
                                : "bg-background border-muted-foreground"
                          )} />
                          
                          {/* Stage info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <CardTitle className={cn(
                                "text-lg",
                                isCurrent && "text-primary"
                              )}>
                                {stage.name || "Unnamed Stage"}
                              </CardTitle>
                              
                              {isCurrent && (
                                <Badge variant="default" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              {stage.location && (
                                <span>📍 {stage.location}</span>
                              )}
                              <span>Sequence: {stage.sequence_order + 1}</span>
                              {stage.full_path && (
                                <span>Path: {stage.full_path}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Stage summary */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {/* Item counts */}
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={hasItems ? "default" : "secondary"}
                              className={cn(
                                hasItems && "bg-primary text-primary-foreground"
                              )}
                            >
                              {itemCount} items
                            </Badge>
                            <Badge 
                              variant={totalQuantity > 0 ? "outline" : "secondary"}
                              className={cn(
                                totalQuantity > 0 && "border-primary text-primary"
                              )}
                            >
                              {totalQuantity} qty
                            </Badge>
                          </div>
                          
                          {/* Expand/collapse indicator */}
                          <div className="ml-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="px-6 pb-6">
                    <div className="space-y-4">
                      {hasItems ? (
                        <>
                          <Separator />
                          <DenseItemCards
                            items={items}
                            stageName={stage.name || "Unnamed Stage"}
                            showStageContext={false}
                          />
                        </>
                      ) : (
                        <>
                          <Separator />
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                            <p>No items in this stage</p>
                          </div>
                        </>
                      )}
                      
                      {/* Stage actions */}
                      <div className="flex gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onStageClick?.(stage.id)}
                        >
                          View Stage Details
                        </Button>
                        
                        {hasItems && (
                          <>
                            <Button variant="outline" size="sm">
                              Bulk Move Items
                            </Button>
                            <Button variant="outline" size="sm">
                              Assign Vendor
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
              
              {/* Flow indicator for next stage */}
              {index < allStages.length - 1 && (
                <div className="flex justify-center my-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
                    <ArrowRight className="h-3 w-3" />
                    <span>Flow to next stage</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Workflow Summary</h3>
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Current Stage</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-background border-2 border-primary" />
                <span>Has Items</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-background border-2 border-muted-foreground" />
                <span>Empty</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}