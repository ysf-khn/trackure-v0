"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
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
import { Loader2, TriangleAlertIcon } from "lucide-react";
import { useWorkflow } from "@/hooks/queries/use-workflow";

// Types based on new_order_items view and workflow structure
type NewOrderItem = {
  item_id: string;
  sku: string;
  buyer_id: string | null;
  original_item_total_quantity: number; // Original total for the item line
  quantity_in_new_pool: number; // Quantity available to allocate from 'New' status
  remaining_quantity: number | null; // For overall workflow completion
  order_id: string;
  order_number: string;
  customer_name: string | null;
  created_at: string;
  organization_id: string;
};

// Type for workflow stage, compatible with useWorkflow hook's expected return structure
type WorkflowStage = {
  id: string;
  name: string;
  // subStages is optional and should match the structure from useWorkflow
  subStages?: Array<{
    id: string;
    name: string;
    // itemCount?: number; // Not strictly needed for allocation logic
  }>;
  // itemCount?: number; // Not strictly needed for allocation logic
};

// Type for the unified allocatable options in the dropdown
type AllocatableOption = {
  id: string; // Composite ID for dropdown value, e.g., "stageId" or "stageId_subStageId"
  label: string; // Display label, e.g., "Stage A" or "Stage X - Sub Y"
  stageId: string;
  subStageId: string | null;
};

type AllocationPayload = {
  stage_id: string;
  sub_stage_id: string | null;
  quantity: number;
};

// Fetch new order items
const fetchNewOrderItems = async (
  organizationId: string | null
): Promise<NewOrderItem[]> => {
  if (!organizationId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("new_order_items")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching new order items:", error);
    throw new Error("Failed to fetch new order items.");
  }
  return data || [];
};

export default function NewOrdersPage() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [organizationId, setOrganizationId] = React.useState<string | null>(
    null
  );

  const [selectedItem, setSelectedItem] = React.useState<NewOrderItem | null>(
    null
  );
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] =
    React.useState(false);
  const [allocationStageId, setAllocationStageId] = React.useState<string>("");
  const [allocationSubStageId, setAllocationSubStageId] = React.useState<
    string | null
  >(null);
  const [allocationQuantity, setAllocationQuantity] = React.useState<number>(1);

  React.useEffect(() => {
    const getOrgId = async () => {
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

  // Use the useWorkflow hook
  const {
    data: workflowStagesData, // Rename to avoid conflict if useWorkflow returns 'data'
    isLoading: isLoadingWorkflow,
    isError: isErrorWorkflow, // Add error handling for workflow fetching
    error: errorWorkflow, // Add error object for workflow fetching
  } = useWorkflow(); // Pass organizationId or undefined

  // Adapt fetched workflowStagesData to the local WorkflowStage[] type if necessary
  // Assuming useWorkflow returns data compatible with WorkflowStage[] defined above
  const workflowStages: WorkflowStage[] | undefined = React.useMemo(() => {
    // The useWorkflow hook's return type is WorkflowStructure from @/lib/queries/workflow
    // which is Stage[]. The Stage type is defined in app-sidebar.tsx
    // interface Stage { id: string; name: string; itemCount: number; subStages?: SubStage[]; }
    // interface SubStage { id: string; name: string; itemCount: number; }
    // This is compatible with the local WorkflowStage type if we ensure names are strings.
    if (workflowStagesData) {
      return workflowStagesData.map((stage) => ({
        ...stage,
        name: stage.name || "Unnamed Stage", // Ensure name is a string
        subStages:
          stage.subStages?.map((sub) => ({
            ...sub,
            name: sub.name || "Unnamed Sub-stage", // Ensure name is a string
          })) || [],
      }));
    }
    return undefined;
  }, [workflowStagesData]);

  // Create a flat list of allocatable options for the dropdown
  const allocatableOptions: AllocatableOption[] = React.useMemo(() => {
    if (!workflowStages) return [];
    const options: AllocatableOption[] = [];
    workflowStages.forEach((stage) => {
      if (stage.subStages && stage.subStages.length > 0) {
        stage.subStages.forEach((subStage) => {
          // Ensure subStage and its properties are defined
          if (subStage && subStage.id && subStage.name) {
            options.push({
              id: `${stage.id}_${subStage.id}`, // Composite ID: stageId_subStageId
              label: `${stage.name} - ${subStage.name}`,
              stageId: stage.id,
              subStageId: subStage.id,
            });
          }
        });
      } else {
        // Ensure stage and its properties are defined
        if (stage && stage.id && stage.name) {
          options.push({
            id: stage.id, // Just stageId if no sub-stages
            label: stage.name,
            stageId: stage.id,
            subStageId: null,
          });
        }
      }
    });
    return options;
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
        p_sub_stage_id: payload.sub_stage_id,
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
      queryClient.invalidateQueries({ queryKey: ["newItemsCount"] }); // To update sidebar
      queryClient.invalidateQueries({ queryKey: ["itemsInStage"] }); // To update stage views

      // Invalidate the workflow sidebar query (which includes counts for the sidebar)
      queryClient.invalidateQueries({ queryKey: ["workflow", "sidebar"] });

      // Invalidate the completed items count query
      queryClient.invalidateQueries({ queryKey: ["completedItemsCount"] });
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
    setAllocationSubStageId(null);
    setIsAllocationDialogOpen(true);
  };

  const handleAllocateItem = () => {
    if (!selectedItem || !allocationStageId || allocationQuantity <= 0) {
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
        sub_stage_id: allocationSubStageId,
        quantity: allocationQuantity,
      },
    });
  };

  // Don't render anything while loading - let loading.tsx handle it
  if (!organizationId || isLoadingItems || isLoadingWorkflow) {
    return null;
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
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.customer_name || "-"}</TableCell>
                      <TableCell>{item.quantity_in_new_pool}</TableCell>
                      <TableCell>{item.original_item_total_quantity}</TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleOpenAllocationDialog(item)}
                          size="sm"
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allocate Item: {selectedItem.sku}</DialogTitle>
              <DialogDescription>
                Allocate from order {selectedItem.order_number}. Available in
                New pool: {selectedItem.quantity_in_new_pool}.
              </DialogDescription>
            </DialogHeader>
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
                  Target
                </Label>
                <Select
                  value={
                    allocationSubStageId
                      ? `${allocationStageId}_${allocationSubStageId}`
                      : allocationStageId || ""
                  }
                  onValueChange={(selectedValue) => {
                    if (!selectedValue) {
                      setAllocationStageId("");
                      setAllocationSubStageId(null);
                      return;
                    }
                    const parts = selectedValue.split("_");
                    setAllocationStageId(parts[0]);
                    setAllocationSubStageId(parts[1] || null);
                  }}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select target stage/sub-stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingWorkflow && (
                      <SelectItem value="loading" disabled>
                        Loading targets...
                      </SelectItem>
                    )}
                    {allocatableOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
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
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAllocationDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAllocateItem}
                disabled={allocationMutation.isPending || isLoadingWorkflow}
              >
                {allocationMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Allocate Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
