"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Users,
  ArrowUpDown,
  Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { StageWithItems } from "@/hooks/queries/use-multi-stage-items";

interface MultiStageHeaderProps {
  currentStage: StageWithItems;
  previousStages: StageWithItems[];
  nextStages: StageWithItems[];
  onStageClick?: (stageId: string) => void;
}

export function MultiStageHeader({
  currentStage,
  previousStages,
  nextStages,
  onStageClick,
}: MultiStageHeaderProps) {
  const router = useRouter();

  const handleStageClick = (stageId: string) => {
    if (onStageClick) {
      onStageClick(stageId);
    } else {
      router.push(`/workflow/${stageId}`);
    }
  };

  const renderStageCard = (
    stageData: StageWithItems, 
    variant: 'previous' | 'current' | 'next',
    showNavigation = false
  ) => {
    const { stage, items, itemCount, totalQuantity } = stageData;
    
    const cardVariant = {
      previous: "outline",
      current: "default", 
      next: "outline"
    } as const;

    const textVariant = {
      previous: "text-muted-foreground",
      current: "text-primary-foreground",
      next: "text-muted-foreground"
    } as const;

    const backgroundVariant = {
      previous: "bg-background hover:bg-muted/50",
      current: "bg-primary text-primary-foreground shadow-lg",
      next: "bg-background hover:bg-muted/50"
    } as const;

    return (
      <Card 
        key={stage.id}
        className={cn(
          "transition-all duration-200 cursor-pointer hover:shadow-md",
          backgroundVariant[variant],
          variant === 'current' && "ring-2 ring-primary ring-offset-2"
        )}
        onClick={() => handleStageClick(stage.id)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className={cn("text-lg", textVariant[variant])}>
              {stage.name || "Unnamed Stage"}
            </CardTitle>
            
            {showNavigation && (
              <div className="flex items-center gap-1">
                {variant === 'previous' && (
                  <ChevronLeft className="h-4 w-4" />
                )}
                {variant === 'next' && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            )}
          </div>
          
          {/* Stage metadata */}
          <div className={cn("flex items-center gap-4 text-sm", textVariant[variant])}>
            {stage.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{stage.location}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <span>Seq: {stage.sequence_order + 1}</span>
            </div>

            {stage.depth_level > 0 && (
              <div className="flex items-center gap-1">
                <span>L{stage.depth_level}</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Item counts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className={cn("h-4 w-4", textVariant[variant])} />
                <span className={cn("font-medium", textVariant[variant])}>
                  {itemCount} items
                </span>
              </div>
              
              <Badge 
                variant={variant === 'current' ? 'secondary' : 'outline'}
                className={cn(
                  variant === 'current' && "bg-primary-foreground text-primary",
                  variant !== 'current' && totalQuantity > 0 && "border-primary text-primary"
                )}
              >
                {totalQuantity} qty
              </Badge>
            </div>

            {/* Item breakdown if there are items */}
            {items.length > 0 && (
              <div className="space-y-1">
                <div className={cn("text-xs", textVariant[variant])}>Recent items:</div>
                <div className="space-y-1">
                  {items.slice(0, 2).map((item) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "text-xs p-2 rounded border-l-2",
                        variant === 'current' 
                          ? "bg-primary-foreground/10 border-primary-foreground" 
                          : "bg-muted border-primary"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {item.order_number || 'N/A'}
                        </span>
                        <span className={cn("text-xs", textVariant[variant])}>
                          {item.sku}
                        </span>
                      </div>
                      {item.entry_type === 'reworked' && (
                        <div className="text-xs text-orange-600 mt-1">
                          Reworked item
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {items.length > 2 && (
                    <div className={cn("text-xs", textVariant[variant])}>
                      +{items.length - 2} more items
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {items.length === 0 && (
              <div className={cn("text-xs italic", textVariant[variant])}>
                No items in this stage
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stage navigation overview */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Multi-Stage View</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          <span>
            Showing {previousStages.length + 1 + nextStages.length} stages
          </span>
        </div>
      </div>

      {/* Stage cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Previous stages */}
        <div className="space-y-4">
          {previousStages.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Previous Stages
              </h3>
              {previousStages.map((stageData) => 
                renderStageCard(stageData, 'previous', true)
              )}
            </>
          )}
        </div>

        {/* Current stage */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
            Current Stage
          </h3>
          {renderStageCard(currentStage, 'current')}
        </div>

        {/* Next stages */}
        <div className="space-y-4">
          {nextStages.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Next Stages
              </h3>
              {nextStages.map((stageData) => 
                renderStageCard(stageData, 'next', true)
              )}
            </>
          )}
        </div>
      </div>

      <Separator className="my-6" />
    </div>
  );
}