"use client";

import React, { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Edit,
  Save,
  X,
  Settings,
  Workflow,
  Package,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const subStageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Sub-stage name is required"),
  description: z.string().optional(),
  estimated_duration_hours: z.coerce.number().min(0).optional(),
  order_index: z.number(),
});

const stageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Stage name is required"),
  description: z.string().optional(),
  estimated_duration_hours: z.coerce.number().min(0).optional(),
  order_index: z.number(),
  parent_stage_id: z.string().optional(),
  sub_stages: z.array(subStageSchema).default([]),
});

const workflowSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  stages: z.array(stageSchema).min(1, "At least one stage is required"),
});

type WorkflowForm = z.infer<typeof workflowSchema>;
type Stage = z.infer<typeof stageSchema>;
type SubStage = z.infer<typeof subStageSchema>;

interface EnhancedWorkflowEditorProps {
  sku?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StageItemProps {
  stage: Stage;
  stageIndex: number;
  onUpdateStage: (index: number, stage: Stage) => void;
  onDeleteStage: (index: number) => void;
  onAddSubStage: (stageIndex: number) => void;
  isNested?: boolean;
  level?: number;
}

function StageItem({
  stage,
  stageIndex,
  onUpdateStage,
  onDeleteStage,
  onAddSubStage,
  isNested = false,
  level = 0,
}: StageItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(stage);

  const handleSave = () => {
    onUpdateStage(stageIndex, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(stage);
    setIsEditing(false);
  };

  const updateSubStage = (subStageIndex: number, subStage: SubStage) => {
    const updatedSubStages = [...editData.sub_stages];
    updatedSubStages[subStageIndex] = subStage;
    setEditData({ ...editData, sub_stages: updatedSubStages });
  };

  const deleteSubStage = (subStageIndex: number) => {
    const updatedSubStages = editData.sub_stages.filter((_, i) => i !== subStageIndex);
    setEditData({ ...editData, sub_stages: updatedSubStages });
  };

  const paddingLeft = `${(level + 1) * 20}px`;

  return (
    <Card className={cn("mb-2", isNested && "ml-4 border-l-4 border-l-blue-200")}>
      <CardHeader className="pb-2" style={{ paddingLeft }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            {stage.sub_stages.length > 0 && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-0 h-auto">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
            {isEditing ? (
              <div className="flex-1 space-y-2">
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Stage name"
                />
                <Textarea
                  value={editData.description || ""}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={2}
                />
                <Input
                  type="number"
                  value={editData.estimated_duration_hours || ""}
                  onChange={(e) => setEditData({ 
                    ...editData, 
                    estimated_duration_hours: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  placeholder="Estimated hours"
                />
              </div>
            ) : (
              <div>
                <CardTitle className="text-base">{stage.name}</CardTitle>
                {stage.description && (
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                )}
                {stage.estimated_duration_hours && (
                  <Badge variant="outline" className="mt-1">
                    {stage.estimated_duration_hours}h
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddSubStage(stageIndex)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteStage(stageIndex)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {stage.sub_stages.length > 0 && (
        <Collapsible open={isOpen}>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {stage.sub_stages.map((subStage, subIndex) => (
                  <StageItem
                    key={`${stageIndex}-${subIndex}`}
                    stage={subStage as Stage}
                    stageIndex={subIndex}
                    onUpdateStage={(_, updatedStage) => updateSubStage(subIndex, updatedStage as SubStage)}
                    onDeleteStage={() => deleteSubStage(subIndex)}
                    onAddSubStage={() => {}}
                    isNested={true}
                    level={level + 1}
                  />
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

export function EnhancedWorkflowEditor({
  sku,
  open,
  onOpenChange,
}: EnhancedWorkflowEditorProps) {
  const queryClient = useQueryClient();
  const [selectedSKU, setSelectedSKU] = useState(sku || "");

  const form = useForm<WorkflowForm>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      sku: selectedSKU,
      stages: [
        {
          name: "New Stage",
          description: "",
          order_index: 0,
          sub_stages: [],
        },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "stages",
  });

  // Fetch existing workflow if SKU is provided
  const { data: existingWorkflow, isLoading } = useQuery({
    queryKey: ["workflow-editor", selectedSKU],
    queryFn: async () => {
      if (!selectedSKU) return null;
      const response = await fetch(`/api/workflow-editor/${selectedSKU}`);
      if (!response.ok) {
        return null; // No existing workflow
      }
      return response.json();
    },
    enabled: open && !!selectedSKU,
  });

  // Fetch available SKUs
  const { data: skuOptions } = useQuery({
    queryKey: ["sku-options"],
    queryFn: async () => {
      const response = await fetch("/api/sku-options");
      if (!response.ok) throw new Error("Failed to fetch SKU options");
      return response.json();
    },
  });

  const saveWorkflowMutation = useMutation({
    mutationFn: async (data: WorkflowForm) => {
      const response = await fetch("/api/workflow-editor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save workflow");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow"] });
      queryClient.invalidateQueries({ queryKey: ["sku-workflow"] });
      toast.success("Workflow saved successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save workflow: ${error.message}`);
    },
  });

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    move(result.source.index, result.destination.index);
  }, [move]);

  const addStage = () => {
    append({
      name: "New Stage",
      description: "",
      order_index: fields.length,
      sub_stages: [],
    });
  };

  const addSubStage = (stageIndex: number) => {
    const stage = fields[stageIndex];
    const updatedStage = {
      ...stage,
      sub_stages: [
        ...stage.sub_stages,
        {
          name: "New Sub-stage",
          description: "",
          order_index: stage.sub_stages.length,
        },
      ],
    };
    form.setValue(`stages.${stageIndex}`, updatedStage);
  };

  const updateStage = (index: number, updatedStage: Stage) => {
    form.setValue(`stages.${index}`, updatedStage);
  };

  const onSubmit = (data: WorkflowForm) => {
    // Update order indices
    const orderedData = {
      ...data,
      stages: data.stages.map((stage, index) => ({
        ...stage,
        order_index: index,
        sub_stages: stage.sub_stages.map((subStage, subIndex) => ({
          ...subStage,
          order_index: subIndex,
        })),
      })),
    };
    
    saveWorkflowMutation.mutate(orderedData);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh]">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Enhanced Workflow Editor
          </DialogTitle>
          <DialogDescription>
            Create and manage multi-level workflow stages for your SKUs with drag-and-drop support.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* SKU Selection */}
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedSKU(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a SKU" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {skuOptions?.skus?.map((sku: any) => (
                        <SelectItem key={sku.sku} value={sku.sku}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span className="font-mono">{sku.sku}</span>
                            {sku.item_name && (
                              <span className="text-muted-foreground">- {sku.item_name}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Workflow Stages */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Workflow Stages</h3>
                <Button type="button" variant="outline" onClick={addStage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stages">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {fields.map((stage, index) => (
                        <Draggable
                          key={stage.id}
                          draggableId={stage.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <StageItem
                                stage={stage}
                                stageIndex={index}
                                onUpdateStage={updateStage}
                                onDeleteStage={remove}
                                onAddSubStage={addSubStage}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {fields.length === 0 && (
                <Card className="text-center py-12">
                  <CardContent>
                    <Workflow className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No stages defined</h3>
                    <p className="text-muted-foreground mb-4">
                      Add stages to define your workflow process.
                    </p>
                    <Button onClick={addStage}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Stage
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveWorkflowMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveWorkflowMutation.isPending}
              >
                {saveWorkflowMutation.isPending ? "Saving..." : "Save Workflow"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}