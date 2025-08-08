"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Workflow, ArrowRight } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StageInPath {
  id: string;
  name: string | null;
  sequence_order: number;
  depth_level: number;
  full_path: string | null;
  is_current?: boolean;
  itemCount?: number;
}

interface WorkflowBreadcrumbTrailProps {
  stagesInPath: StageInPath[];
  currentStageId: string;
  isLoading?: boolean;
  onStageClick?: (stageId: string) => void;
}

export function WorkflowBreadcrumbTrail({
  stagesInPath,
  currentStageId,
  isLoading = false,
  onStageClick,
}: WorkflowBreadcrumbTrailProps) {
  const router = useRouter();

  const handleStageClick = (stageId: string) => {
    if (onStageClick) {
      onStageClick(stageId);
    } else {
      router.push(`/workflow/${stageId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/workflow-hub">Workflow Hub</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Skeleton className="h-5 w-32" />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Skeleton className="h-8 w-24 flex-shrink-0" />
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Skeleton className="h-8 w-24 flex-shrink-0" />
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Skeleton className="h-8 w-32 flex-shrink-0" />
        </div>
      </div>
    );
  }

  const currentStage = stagesInPath.find(stage => stage.id === currentStageId);

  return (
    <div className="space-y-3">
      {/* Standard Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/workflow-hub">Workflow Hub</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentStage?.name || "Stage"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Workflow Progress Trail */}
      {stagesInPath.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Workflow className="h-4 w-4" />
            <span>Workflow Progress</span>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {stagesInPath.map((stage, index) => {
              const isCurrent = stage.id === currentStageId;
              const isPast = index < stagesInPath.findIndex(s => s.id === currentStageId);
              const isFuture = index > stagesInPath.findIndex(s => s.id === currentStageId);

              return (
                <React.Fragment key={stage.id}>
                  <Button
                    variant={isCurrent ? "default" : isPast ? "outline" : "ghost"}
                    size="sm"
                    className={cn(
                      "flex-shrink-0 h-auto py-2 px-3",
                      isCurrent && "bg-primary text-primary-foreground shadow-sm",
                      isPast && "border-green-200 text-green-700 hover:bg-green-50",
                      isFuture && "text-muted-foreground border-dashed"
                    )}
                    onClick={() => handleStageClick(stage.id)}
                    disabled={isFuture}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">
                          {stage.name || "Unnamed"}
                        </span>
                        {stage.itemCount !== undefined && stage.itemCount > 0 && (
                          <Badge 
                            variant={isCurrent ? "secondary" : "outline"} 
                            className={cn(
                              "text-xs px-1.5 py-0.5",
                              isCurrent && "bg-primary-foreground text-primary"
                            )}
                          >
                            {stage.itemCount}
                          </Badge>
                        )}
                      </div>
                      {stage.full_path && stage.depth_level > 0 && (
                        <div className="text-xs opacity-75">
                          Level {stage.depth_level}
                        </div>
                      )}
                    </div>
                  </Button>

                  {index < stagesInPath.length - 1 && (
                    <ArrowRight 
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isPast ? "text-green-500" : "text-muted-foreground"
                      )} 
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Progress Summary */}
          <div className="text-xs text-muted-foreground">
            Stage {stagesInPath.findIndex(s => s.id === currentStageId) + 1} of {stagesInPath.length}
            {currentStage?.full_path && ` • Path: ${currentStage.full_path}`}
          </div>
        </div>
      )}
    </div>
  );
}