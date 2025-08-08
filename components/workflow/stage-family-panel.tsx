"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import { useStageItemCounts } from "@/hooks/queries/use-stage-item-counts";
import { calculateDetailedStageCount } from "@/hooks/queries/use-stage-item-counts";
import { cn } from "@/lib/utils";

interface StageData {
  id: string;
  name: string | null;
  sequence_order: number;
  location: string | null;
  parent_stage_id: string | null;
  depth_level: number;
  full_path: string | null;
  is_leaf_stage: boolean;
  sku: string | null;
}

interface StageFamilyPanelProps {
  currentStage: StageData | undefined | null;
  organizationId: string | undefined | null;
}

export function StageFamilyPanel({
  currentStage,
  organizationId,
}: StageFamilyPanelProps) {
  const router = useRouter();
  const { selectedSKU } = useSKUSelection();
  
  // Get workflow structure to find related stages
  const { data: workflowData, isLoading: isLoadingWorkflow } = 
    useWorkflowStructure(organizationId, currentStage?.sku || selectedSKU);

  // Get stage item counts
  const { data: stageCountsData, isLoading: isLoadingStageCounts } =
    useStageItemCounts(organizationId, currentStage?.sku || selectedSKU, workflowData);

  const relatedStages = React.useMemo(() => {
    if (!workflowData || !currentStage) return { parent: null, siblings: [], children: [] };

    // Find current stage in the workflow tree
    const findStageInTree = (stages: any[], targetId: string): any => {
      for (const stage of stages) {
        if (stage.id === targetId) return stage;
        if (stage.children) {
          const found = findStageInTree(stage.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    // Find parent stage
    const findParentStage = (stages: any[], targetId: string, parent: any = null): any => {
      for (const stage of stages) {
        if (stage.id === targetId) return parent;
        if (stage.children) {
          const found = findParentStage(stage.children, targetId, stage);
          if (found !== null) return found;
        }
      }
      return null;
    };

    const currentStageInTree = findStageInTree(workflowData, currentStage.id);
    const parentStage = findParentStage(workflowData, currentStage.id);
    
    // Get siblings (stages at the same level with same parent)
    const siblings = [];
    if (parentStage && parentStage.children) {
      siblings.push(...parentStage.children.filter((s: any) => s.id !== currentStage.id));
    } else if (!parentStage) {
      // Top level siblings
      siblings.push(...workflowData.filter((s: any) => s.id !== currentStage.id));
    }

    // Get children
    const children = currentStageInTree?.children || [];

    return {
      parent: parentStage,
      siblings: siblings.slice(0, 3), // Limit to 3 for space
      children: children.slice(0, 3), // Limit to 3 for space
    };
  }, [workflowData, currentStage]);

  const handleStageClick = (stageId: string) => {
    router.push(`/workflow/${stageId}`);
  };

  const renderStageButton = (stage: any, label: string) => {
    if (!stage) return null;

    const detailedCount = stageCountsData?.stageCountsMap
      ? calculateDetailedStageCount(
          stage.id,
          workflowData || [],
          stageCountsData.stageCountsMap
        )
      : { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
    
    const itemCount = detailedCount.totalQuantity;
    const hasReworked = detailedCount.reworkedQuantity > 0;

    return (
      <div key={stage.id} className="space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between h-auto py-2"
          onClick={() => handleStageClick(stage.id)}
        >
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-sm truncate">
              {stage.name || "Unnamed Stage"}
            </div>
            {stage.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{stage.location}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            {isLoadingStageCounts ? (
              <Skeleton className="h-5 w-6 rounded" />
            ) : (
              <>
                {hasReworked ? (
                  <div className="flex items-center gap-1">
                    <Badge variant="default" className="text-xs px-1.5 py-0.5">
                      {detailedCount.normalQuantity}
                    </Badge>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Badge variant="destructive" className="bg-orange-500 text-white text-xs px-1.5 py-0.5">
                      {detailedCount.reworkedQuantity}
                    </Badge>
                  </div>
                ) : (
                  <Badge
                    variant={itemCount > 0 ? "default" : "secondary"}
                    className={cn(
                      "text-xs px-1.5 py-0.5",
                      itemCount > 0 && "bg-primary text-white"
                    )}
                  >
                    {itemCount}
                  </Badge>
                )}
              </>
            )}
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
        </Button>
      </div>
    );
  };

  if (isLoadingWorkflow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stage Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!workflowData || !currentStage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stage Context</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No workflow context available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Stage Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parent Stage */}
        {relatedStages.parent && (
          <>
            {renderStageButton(relatedStages.parent, "Parent Stage")}
            <Separator />
          </>
        )}

        {/* Current Stage Info */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Current Stage</div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="font-medium text-sm">
              {currentStage.name || "Unnamed Stage"}
            </div>
            <div className="text-xs text-muted-foreground">
              Depth Level: {currentStage.depth_level}
            </div>
            {currentStage.full_path && (
              <div className="text-xs text-muted-foreground">
                Path: {currentStage.full_path}
              </div>
            )}
          </div>
        </div>

        {/* Siblings */}
        {relatedStages.siblings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sibling Stages
              </div>
              <div className="space-y-2">
                {relatedStages.siblings.map((stage) => 
                  renderStageButton(stage, `Sequence ${stage.sequence_order + 1}`)
                )}
              </div>
            </div>
          </>
        )}

        {/* Children */}
        {relatedStages.children.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">Child Stages</div>
              <div className="space-y-2">
                {relatedStages.children.map((stage) => 
                  renderStageButton(stage, `Sequence ${stage.sequence_order + 1}`)
                )}
              </div>
            </div>
          </>
        )}

        {/* Quick Navigation */}
        <Separator />
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => router.push('/workflow-hub')}
          >
            View Full Workflow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}