"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { invalidateAllItemRelatedQueries } from "@/lib/cache-invalidation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, TriangleAlertIcon, RefreshCw, InfoIcon, Settings2Icon } from "lucide-react";
import { useWorkflowStructure, type FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";
import { useSKUWorkflowState, getAllocationStrategy } from "@/hooks/queries/use-sku-workflow-state";
import { useSKUTemplates, useApplyTemplate } from "@/hooks/queries/use-sku-templates";
import { useRouter } from "next/navigation";

// Types based on new_order_items_consolidated view and workflow structure
type NewOrderItem = {
  item_id: string;
  sku: string;
  buyer_id: string | null;
  original_item_total_quantity: number; // Original total for the item line (adjusted for complete scraps)
  quantity_in_new_pool: number; // Quantity available to allocate from 'New' status
  remaining_quantity: number | null; // For overall workflow completion
  order_id: string;
  order_number: string;
  customer_name: string | null;
  created_at: string;
  organization_id: string;
  // Additional fields from consolidated view
  replacement_count: number; // Number of replacement items consolidated
  total_replacement_quantity: number; // Total quantity from all replacements
  original_total_before_scraps: number; // Original total before any scrapping
};

// Type for workflow stage - using the tree structure from useWorkflowStructure
type WorkflowStage = FetchedWorkflowStage;

// Type for the unified allocatable options in the dropdown
type AllocatableOption = {
  id: string; // Stage ID for dropdown value
  label: string; // Display label with breadcrumb path
  stageId: string;
  depth: number; // For visual indentation
  isLeaf: boolean; // Only leaf stages can receive items
};

type AllocationPayload = {
  stage_id: string;
  quantity: number;
};

// Fetch new order items (using consolidated view)
const fetchNewOrderItems = async (
  organizationId: string | null
): Promise<NewOrderItem[]> => {
  if (!organizationId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("new_order_items_consolidated")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching consolidated new order items:", error);
    throw new Error("Failed to fetch new order items.");
  }
  return data || [];
};

export default function NewOrdersPage() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const router = useRouter();
  const [organizationId, setOrganizationId] = React.useState<string | null>(
    null
  );
  const [isLoadingOrg, setIsLoadingOrg] = React.useState(true);

  const [selectedItem, setSelectedItem] = React.useState<NewOrderItem | null>(
    null
  );
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] =
    React.useState(false);
  const [allocationStageId, setAllocationStageId] = React.useState<string>("");
  const [allocationQuantity, setAllocationQuantity] = React.useState<number>(1);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const getOrgId = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();
          if (profile?.organization_id) {
            setOrganizationId(profile.organization_id);
          }
        }
      } catch (error) {
        console.error("Error fetching organization ID:", error);
      } finally {
        setIsLoadingOrg(false);
      }
    };
    getOrgId();
  }, [supabase]);

  const {
    data: newOrderItems,
    isLoading: isLoadingItems,
    isError: isErrorItems,
    error: errorItems,
  } = useQuery<NewOrderItem[], Error>({
    queryKey: ["newOrderItems", organizationId],
    queryFn: () => fetchNewOrderItems(organizationId),
    enabled: !!organizationId,
  });

  // Use the useWorkflowStructure hook with SKU filtering
  const {
    data: workflowStagesData,
    isLoading: isLoadingWorkflow,
    isError: isErrorWorkflow,
    error: errorWorkflow,
  } = useWorkflowStructure(organizationId, selectedItem?.sku);

  // workflowStagesData is already in the correct format from useWorkflowStructure
  const workflowStages: WorkflowStage[] | undefined = workflowStagesData;

  // Check SKU workflow state
  const {
    data: workflowState,
    isLoading: isLoadingWorkflowState,
  } = useSKUWorkflowState(selectedItem?.sku, organizationId, isAllocationDialogOpen);

  // Get allocation strategy based on workflow state
  const allocationStrategy = React.useMemo(() => {
    // Don't determine strategy while still loading workflow state
    if (isLoadingWorkflowState) {
      return {
        strategy: 'loading',
        message: 'Checking workflow configuration...',
        canAllocate: false,
        needsTemplate: false,
        needsConfiguration: false
      };
    }
    return getAllocationStrategy(workflowState);
  }, [workflowState, isLoadingWorkflowState]);

  // Fetch templates for the SKU
  const {
    data: templates,
    isLoading: isLoadingTemplates,
  } = useSKUTemplates(
    selectedItem?.sku, 
    organizationId,
    isAllocationDialogOpen && allocationStrategy.needsTemplate
  );

  // Apply template mutation
  const applyTemplateMutation = useApplyTemplate();

  // Create a flat list of allocatable options for the dropdown (recursive for tree structure)
  const allocatableOptions: AllocatableOption[] = React.useMemo(() => {
    if (!workflowStages) return [];
    
    const flattenStages = (stages: WorkflowStage[], depth = 0, parentPath: string[] = []): AllocatableOption[] => {
      const options: AllocatableOption[] = [];
      
      stages.forEach((stage) => {
        if (stage && stage.id && stage.name) {
          const currentPath = [...parentPath, stage.name];
          
          // Only add leaf stages (stages without children) as allocatable options
          // OR stages that explicitly allow item allocation
          if (stage.is_leaf_stage || !stage.children || stage.children.length === 0) {
            // Create breadcrumb-style label
            const breadcrumbLabel = currentPath.join(' → ');
            
            options.push({
              id: stage.id,
              label: breadcrumbLabel,
              stageId: stage.id,
              depth,
              isLeaf: stage.is_leaf_stage || !stage.children || stage.children.length === 0,
            });
          }
          
          // Recursively process child stages
          if (stage.children && stage.children.length > 0) {
            options.push(...flattenStages(stage.children, depth + 1, currentPath));
          }
        }
      });
      
      return options;
    };
    
    return flattenStages(workflowStages);
  }, [workflowStages]);

  const allocationMutation = useMutation<
    void,
    Error,
    { itemId: string; payload: AllocationPayload }
  >({
    mutationFn: async ({ itemId, payload }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { error } = await supabase.rpc("allocate_item_to_workflow", {
        p_item_id: itemId,
        p_stage_id: payload.stage_id,
        p_quantity: payload.quantity,
        p_allocated_by: user.id,
      });

      if (error) {
        console.error("Allocation error (RPC):", error);
        throw new Error(error.message || "Failed to allocate item.");
      }
    },
    onSuccess: () => {
      toast.success("Item allocated successfully!");
      queryClient.invalidateQueries({
        queryKey: ["newOrderItems", organizationId],
      });
      // Use centralized cache invalidation for consistency
      invalidateAllItemRelatedQueries(queryClient, organizationId);
      setIsAllocationDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error) => {
      toast.error(`Allocation failed: ${error.message}`);
    },
  });

  const handleOpenAllocationDialog = (item: NewOrderItem) => {
    setSelectedItem(item);
    setAllocationQuantity(item.quantity_in_new_pool); // Default to max allocatable from new pool
    setAllocationStageId("");
    setSelectedTemplateId(null);
    setIsAllocationDialogOpen(true);
  };

  // Set default stage when workflow state loads
  React.useEffect(() => {
    if (allocationStrategy.defaultStageId && !allocationStageId) {
      setAllocationStageId(allocationStrategy.defaultStageId);
    }
  }, [allocationStrategy.defaultStageId, allocationStageId]);

  const handleAllocateItem = async () => {
    if (!selectedItem) {
      toast.error("No item selected.");
      return;
    }

    // Check if we need to configure workflow first
    if (allocationStrategy.needsConfiguration) {
      router.push(`/settings?tab=workflow&sku=${selectedItem.sku}`);
      return;
    }

    // Check if we need to apply a template first
    if (allocationStrategy.needsTemplate && selectedTemplateId) {
      try {
        await applyTemplateMutation.mutateAsync({
          templateId: selectedTemplateId,
          sku: selectedItem.sku,
          organizationId: organizationId!
        });
        // After template is applied, the workflow will be created
        // Refresh the workflow structure
        await queryClient.invalidateQueries({
          queryKey: ["workflow", "structure", organizationId, selectedItem.sku]
        });
      } catch (error) {
        console.error("Failed to apply template:", error);
        return;
      }
    }

    if (!allocationStageId || allocationQuantity <= 0) {
      toast.error("Please select a stage and enter a valid quantity.");
      return;
    }
    if (allocationQuantity > selectedItem.quantity_in_new_pool) {
      toast.error(
        `Quantity cannot exceed available in New pool: ${selectedItem.quantity_in_new_pool}`
      );
      return;
    }

    allocationMutation.mutate({
      itemId: selectedItem.item_id,
      payload: {
        stage_id: allocationStageId,
        quantity: allocationQuantity,
      },
    });
  };

  // Show consistent loading state for hydration
  if (isLoadingOrg || (!organizationId && !isLoadingOrg) || isLoadingItems || isLoadingWorkflow) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>New Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Add error display for workflow loading
  if (isErrorWorkflow) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <TriangleAlertIcon className="h-4 w-4" />
          <AlertDescription>
            Error loading workflow configuration:{" "}
            {errorWorkflow?.message || "Unknown error"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingItems && <Loader2 className="h-6 w-6 animate-spin" />}
          {isErrorItems && (
            <Alert variant="destructive">
              <TriangleAlertIcon className="h-4 w-4" />
              <AlertDescription>{errorItems?.message}</AlertDescription>
            </Alert>
          )}
          {!isLoadingItems &&
            !isErrorItems &&
            (!newOrderItems || newOrderItems.length === 0) && (
              <p>No new items waiting for allocation.</p>
            )}
          {!isLoadingItems &&
            !isErrorItems &&
            newOrderItems &&
            newOrderItems.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Item SKU</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Unallocated Quantity</TableHead>
                    <TableHead>Original Total</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newOrderItems.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell>{item.order_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.sku}
                          {item.replacement_count > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              {item.replacement_count}x Replaced
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.customer_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.quantity_in_new_pool}</span>
                          {item.replacement_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              (from {item.total_replacement_quantity} replaced)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.original_item_total_quantity}</span>
                          {item.original_total_before_scraps !== item.original_item_total_quantity && (
                            <span className="text-xs text-muted-foreground line-through">
                              (was {item.original_total_before_scraps})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleOpenAllocationDialog(item)}
                          size="sm"
                          className="bg-primary text-white"
                        >
                          Allocate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      {selectedItem && (
        <Dialog
          open={isAllocationDialogOpen}
          onOpenChange={setIsAllocationDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Allocate Item: {selectedItem.sku}</DialogTitle>
              <DialogDescription>
                Allocate from order {selectedItem.order_number}. Available in
                New pool: {selectedItem.quantity_in_new_pool}.
              </DialogDescription>
            </DialogHeader>

            {/* Show workflow state information */}
            {isLoadingWorkflowState ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Checking workflow state...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Workflow State Alert */}
                {allocationStrategy.strategy && (
                  <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {allocationStrategy.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Show active items in workflow if any */}
                {workflowState?.active_items_in_workflow > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-medium">
                      Active Items in Workflow
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {workflowState.active_items_in_workflow} item(s) of this SKU are currently being processed.
                      New items will join the existing workflow.
                    </p>
                  </div>
                )}

                {/* Template Selection (only if needed) */}
                {allocationStrategy.needsTemplate && templates && templates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Workflow Template</Label>
                    <Select
                      value={selectedTemplateId || allocationStrategy.activeTemplateId || ""}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template to apply" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{template.name}</span>
                              {template.is_active && (
                                <span className="text-xs text-green-600">Active</span>
                              )}
                              {template.description && (
                                <span className="text-xs text-muted-foreground">
                                  {template.description}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Configure Workflow Button (if needed) */}
                {allocationStrategy.needsConfiguration && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium mb-3">
                      Workflow Configuration Required
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      No workflow has been configured for SKU "{selectedItem.sku}". 
                      Please set up the workflow stages before allocating items.
                    </p>
                    <Button
                      onClick={() => {
                        setIsAllocationDialogOpen(false);
                        router.push(`/settings?tab=workflow&sku=${selectedItem.sku}`);
                      }}
                      className="w-full"
                      variant="default"
                    >
                      <Settings2Icon className="mr-2 h-4 w-4" />
                      Configure Workflow for {selectedItem.sku}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Only show allocation controls if we can allocate */}
            {allocationStrategy.canAllocate && !allocationStrategy.needsConfiguration && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantity" className="text-right">
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={allocationQuantity}
                    onChange={(e) =>
                      setAllocationQuantity(
                        Math.max(1, parseInt(e.target.value, 10))
                      )
                    }
                    max={selectedItem.quantity_in_new_pool}
                    min={1}
                    className="col-span-3"
                  />
                </div>
                {/* Single Select for Stage/Sub-stage */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="target" className="text-right">
                    Target Stage
                  </Label>
                  <Select
                    value={allocationStageId || ""}
                    onValueChange={(selectedValue) => {
                      if (!selectedValue) {
                        setAllocationStageId("");
                                            return;
                      }
                      // In tree structure, the selectedValue is just the stage ID
                      setAllocationStageId(selectedValue);
                    }}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select target stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingWorkflow && (
                        <SelectItem value="loading" disabled>
                          Loading targets...
                        </SelectItem>
                      )}
                      {allocatableOptions.map((option) => (
                        <SelectItem 
                          key={option.id} 
                          value={option.id}
                          className="py-2"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm">{option.label}</span>
                            {option.depth > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                                Level {option.depth + 1}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {!isLoadingWorkflow &&
                        allocatableOptions.length === 0 &&
                        !isErrorWorkflow && (
                          <SelectItem value="no-targets" disabled>
                            No targets configured.
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAllocationDialogOpen(false)}
              >
                Cancel
              </Button>
              {allocationStrategy.canAllocate && !allocationStrategy.needsConfiguration && (
                <Button
                  onClick={handleAllocateItem}
                  disabled={
                    allocationMutation.isPending || 
                    isLoadingWorkflow || 
                    isLoadingWorkflowState ||
                    applyTemplateMutation.isPending ||
                    (allocationStrategy.needsTemplate && !selectedTemplateId && !allocationStrategy.activeTemplateId)
                  }
                  className="bg-primary text-white"
                >
                  {(allocationMutation.isPending || applyTemplateMutation.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {allocationStrategy.needsTemplate ? 'Apply Template & Allocate' : 'Allocate Item'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
