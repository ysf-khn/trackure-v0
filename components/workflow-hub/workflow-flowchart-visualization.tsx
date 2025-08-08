"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";
import { calculateDetailedStageCount } from "@/hooks/queries/use-stage-item-counts";

interface WorkflowFlowchartVisualizationProps {
  workflowData: FetchedWorkflowStage[];
  stageCountsData: any;
  isLoadingStageCounts: boolean;
  onStageClick: (stageId: string) => void;
  currentStageId?: string;
}

interface StageBoxProps {
  stage: FetchedWorkflowStage;
  stageCountsData: any;
  isLoadingStageCounts: boolean;
  onStageClick: (stageId: string) => void;
  isCurrentStage: boolean;
  workflowData: FetchedWorkflowStage[];
}

function StageBox({
  stage,
  stageCountsData,
  isLoadingStageCounts,
  onStageClick,
  isCurrentStage,
  workflowData,
}: StageBoxProps) {
  const stageName = stage.name || "Unnamed Stage";
  
  // Calculate item counts for this stage
  const detailedCount = stageCountsData?.stageCountsMap
    ? calculateDetailedStageCount(
        stage.id,
        workflowData,
        stageCountsData.stageCountsMap
      )
    : { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
  
  const itemCount = detailedCount.totalQuantity;
  const hasReworked = detailedCount.reworkedQuantity > 0;

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => onStageClick(stage.id)}
        className={cn(
          "flex flex-col items-center justify-center p-4 h-auto min-w-[120px] min-h-[80px] border-2 transition-all duration-200 hover:shadow-md",
          isCurrentStage
            ? "border-primary bg-primary/10 shadow-md"
            : "border-gray-300 hover:border-primary/50"
        )}
      >
        <div className="text-center space-y-2">
          <div className="font-medium text-sm leading-tight">
            {stageName.length > 12 ? `${stageName.slice(0, 12)}...` : stageName}
          </div>
          
          {/* Item counts */}
          <div className="flex items-center justify-center gap-1">
            {isLoadingStageCounts ? (
              <Skeleton className="h-5 w-8 rounded-full" />
            ) : (
              <>
                {hasReworked ? (
                  <>
                    <Badge
                      variant="default"
                      className="bg-primary text-white text-xs px-1.5 py-0.5"
                    >
                      {detailedCount.normalQuantity}
                    </Badge>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Badge
                      variant="destructive"
                      className="bg-orange-500 text-white text-xs px-1.5 py-0.5"
                    >
                      {detailedCount.reworkedQuantity}
                    </Badge>
                  </>
                ) : (
                  <Badge
                    variant={itemCount > 0 ? "default" : "secondary"}
                    className={cn(
                      "text-xs px-2 py-0.5",
                      itemCount > 0 && "bg-primary text-white"
                    )}
                  >
                    {itemCount}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </Button>
    </div>
  );
}

function ConnectorLine({ direction = "horizontal" }: { direction?: "horizontal" | "vertical" }) {
  if (direction === "horizontal") {
    return (
      <div className="flex items-center justify-center w-12 h-2">
        <div className="w-full h-0.5 bg-gray-400"></div>
        <div className="w-0 h-0 border-l-[6px] border-l-gray-400 border-y-[3px] border-y-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center w-2 h-8">
      <div className="w-0.5 h-full bg-gray-400"></div>
      <div className="w-0 h-0 border-t-[6px] border-t-gray-400 border-x-[3px] border-x-transparent"></div>
    </div>
  );
}

export function WorkflowFlowchartVisualization({
  workflowData,
  stageCountsData,
  isLoadingStageCounts,
  onStageClick,
  currentStageId,
}: WorkflowFlowchartVisualizationProps) {
  if (!workflowData || workflowData.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No workflow data available</p>
      </div>
    );
  }

  // Separate main stages (depth 0) and organize their children
  const mainStages = workflowData.filter(stage => stage.depth_level === 0);

  return (
    <div className="relative w-full">
      {/* Scrollable container */}
      <div className="overflow-auto max-h-[500px] min-h-[300px] p-6 bg-gray-50/30 border rounded-lg">
        <div className="min-w-fit space-y-8">
          {/* Main horizontal flow */}
          <div className="flex items-start gap-4">
            {mainStages.map((stage, index) => (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center space-y-4">
                  {/* Main stage */}
                  <StageBox
                    stage={stage}
                    stageCountsData={stageCountsData}
                    isLoadingStageCounts={isLoadingStageCounts}
                    onStageClick={onStageClick}
                    isCurrentStage={currentStageId === stage.id}
                    workflowData={workflowData}
                  />
                  
                  {/* Children stages below */}
                  {stage.children && stage.children.length > 0 && (
                    <>
                      <ConnectorLine direction="vertical" />
                      <div className="space-y-4">
                        {stage.children.map((child) => (
                          <div key={child.id} className="flex flex-col items-center space-y-4">
                            <StageBox
                              stage={child}
                              stageCountsData={stageCountsData}
                              isLoadingStageCounts={isLoadingStageCounts}
                              onStageClick={onStageClick}
                              isCurrentStage={currentStageId === child.id}
                              workflowData={workflowData}
                            />
                            
                            {/* Render nested children recursively */}
                            {child.children && child.children.length > 0 && (
                              <>
                                <ConnectorLine direction="vertical" />
                                <div className="space-y-4">
                                  {child.children.map((grandchild) => (
                                    <StageBox
                                      key={grandchild.id}
                                      stage={grandchild}
                                      stageCountsData={stageCountsData}
                                      isLoadingStageCounts={isLoadingStageCounts}
                                      onStageClick={onStageClick}
                                      isCurrentStage={currentStageId === grandchild.id}
                                      workflowData={workflowData}
                                    />
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Horizontal connector between main stages */}
                {index < mainStages.length - 1 && (
                  <div className="flex items-center justify-center mt-10">
                    <ConnectorLine direction="horizontal" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-2 right-2">
        <Badge variant="outline" className="text-xs bg-background/80 backdrop-blur">
          Scroll to view full workflow
        </Badge>
      </div>
    </div>
  );
}