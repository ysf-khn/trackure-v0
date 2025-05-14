"use client";

import * as React from "react";
import { useState } from "react";
import {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  Table as ReactTable, // For getting table instance
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner"; // Import toast

import {
  MoreHorizontal,
  ChevronRight,
  History,
  Download,
  ChevronsRight, // Icon for submenu
  Info, // Import the Info icon
  RotateCcw, // Icon for Rework
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ItemInStage } from "@/hooks/queries/use-items-in-stage"; // Keep type import
import { useMoveItemsForward } from "@/hooks/mutations/use-move-items-forward";
import { useReworkItems } from "@/hooks/mutations/use-rework-items"; // Import rework hook
import { ItemHistoryModal } from "./item-history-modal";
import { AddRemarkModal } from "./add-remark-modal";
import { ItemDetailsModal } from "./item-details-modal"; // Import the new modal
import { MoveItemQuantityModal } from "./move-item-quantity-modal"; // Import the new modal
import {
  BulkMoveQuantityModal,
  ItemForBulkMove,
} from "./bulk-move-quantity-modal"; // Import for bulk move
import { SingleItemReworkQuantityModal } from "./single-item-rework-quantity-modal"; // Import single rework modal
import {
  BulkReworkQuantityModal,
  ItemForBulkRework,
} from "@/components/items/bulk-rework-quantity-modal"; // Import bulk rework modal
import { ItemTableCore, ItemTableCoreHandles } from "./item-table-core"; // Import ItemTableCoreHandles
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import {
  useWorkflowStructure,
  FetchedWorkflowStage,
} from "@/hooks/queries/use-workflow-structure"; // Import the hook AND type
import {
  getSubsequentStages,
  determineNextStage,
  determinePreviousStage,
} from "@/lib/workflow-utils"; // Assuming this utility function exists or will be created
import { useDebounce } from "@/hooks/queries/use-debounce";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

// --- Types --- //

// Item details for single item rework modal
interface ItemForSingleRework {
  id: string;
  sku: string | null;
  currentQuantity: number;
}

// Updated meta type for table actions
interface ItemListTableMeta {
  onViewHistory?: (itemId: string, itemSku: string) => void;
  onViewDetails?: (details: Record<string, unknown>, itemName: string) => void;
  handleMoveForward: (
    itemsToMove: { id: string; quantity: number }[],
    targetStageId?: string | null
  ) => void;
  handleOpenSingleReworkQuantityModal?: (item: ItemForSingleRework) => void; // New for single rework
  isMovingItems: boolean;
  isReworkingItems: boolean; // New loading state for rework
  userRole?: string | null;
  workflowData?: FetchedWorkflowStage[];
  isWorkflowLoading: boolean;
  currentStageId: string;
  currentSubStageId: string | null;
  subsequentStages?: { id: string; name: string | null }[];
  handleOpenMoveQuantityModal?: (details: ItemToMoveDetails) => void;
}

// --- Columns Definition (kept here for clarity) --- //

// Define Columns - Adding meta type for mutation access
// Note: The 'meta' accessed here will be passed down to ItemTableCore
export const columns: ColumnDef<ItemInStage>[] = [
  {
    id: "select",
    header: ({ table }) => {
      // Access meta through table options
      const meta = table.options.meta as ItemListTableMeta | undefined; // Use defined type
      if (
        !meta?.userRole ||
        (meta.userRole !== "Owner" && meta.userRole !== "Worker")
      ) {
        return null;
      }
      return (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value: boolean) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
          disabled={meta?.isMovingItems || meta?.isReworkingItems}
        />
      );
    },
    cell: ({ row, table }) => {
      const meta = table.options.meta as ItemListTableMeta | undefined; // Use defined type
      if (
        !meta?.userRole ||
        (meta.userRole !== "Owner" && meta.userRole !== "Worker")
      ) {
        return null;
      }
      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
          aria-label="Select row"
          disabled={meta?.isMovingItems || meta?.isReworkingItems}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => <div className="font-medium">{row.getValue("sku")}</div>,
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => <div>{row.getValue("quantity")}</div>,
  },
  {
    accessorKey: "instance_details",
    header: "Details",
    cell: ({ row, table }) => {
      const details = row.getValue("instance_details") as Record<
        string,
        unknown
      >;
      const meta = table.options.meta as ItemListTableMeta | undefined;
      const itemName = row.original.sku; // Or any other display name

      if (!meta?.onViewDetails) {
        return <div className="truncate w-32">{JSON.stringify(details)}</div>; // Fallback or null
      }

      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => meta.onViewDetails?.(details, itemName)}
          disabled={meta.isMovingItems || meta.isReworkingItems}
          aria-label="View Item Details"
        >
          <Info className="h-4 w-4 mr-2" />
          View Details
        </Button>
      );
    },
  },
  {
    accessorKey: "current_stage_entered_at",
    header: "Time in Stage",
    cell: ({ row }) => {
      const enteredAt = row.getValue("current_stage_entered_at") as
        | string
        | null;
      if (!enteredAt) return <div>-</div>;
      try {
        return (
          <div>
            {formatDistanceToNow(new Date(enteredAt), { addSuffix: true })}
          </div>
        );
      } catch (error) {
        console.error("Error formatting date:", error);
        return <div>Invalid Date</div>;
      }
    },
    sortingFn: "datetime", // Enable sorting by date
  },
  {
    id: "history",
    header: "History",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as ItemListTableMeta | undefined;
      const canViewHistory = !!meta?.onViewHistory; // Button enabled if handler exists

      if (!canViewHistory) {
        return null; // Or potentially a disabled placeholder
      }

      return (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => meta.onViewHistory?.(item.id, item.sku)}
          disabled={meta.isMovingItems || meta.isReworkingItems}
          aria-label="View Item History"
        >
          <History className="h-4 w-4" />
        </Button>
      );
    },
    enableSorting: false,
  },
  {
    id: "voucher",
    header: "Voucher",
    cell: ({ row, table }) => {
      const item = row.original as ItemInStage & {
        current_stage_history_id?: string;
      };
      const meta = table.options.meta as ItemListTableMeta | undefined;
      const canDownload =
        meta?.userRole === "Owner" && !!item.current_stage_history_id;

      if (!canDownload) {
        return null; // Or a placeholder/disabled button
      }

      return (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          asChild
          disabled={meta.isMovingItems || meta.isReworkingItems}
          aria-label="Download Voucher for this Stage"
        >
          <a
            href={`/api/vouchers/${item.id}?history_id=${item.current_stage_history_id}`}
            target="_blank"
            rel="noopener noreferrer"
            // Prevent click propagation if needed, though 'asChild' might handle this
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
        </Button>
      );
    },
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as ItemListTableMeta | undefined;

      // Extract necessary info from meta
      const {
        subsequentStages,
        isWorkflowLoading,
        workflowData,
        currentStageId,
        currentSubStageId,
      } = meta || {};

      // Determine if there are next or previous steps
      const hasNextStep =
        workflowData && currentStageId
          ? determineNextStage(
              currentStageId,
              currentSubStageId ?? null,
              workflowData
            ) !== null
          : false;
      const hasPreviousStep =
        workflowData && currentStageId
          ? determinePreviousStage(
              currentStageId,
              currentSubStageId ?? null,
              workflowData
            ) !== null
          : false;

      const handleOpenSingleItemRework = () => {
        if (meta?.handleOpenSingleReworkQuantityModal) {
          meta.handleOpenSingleReworkQuantityModal({
            id: item.id,
            sku: item.sku,
            currentQuantity: item.quantity,
          });
        }
      };

      const handleOpenMoveModal = (targetStageId?: string | null) => {
        const targetStage = targetStageId
          ? subsequentStages?.find((s) => s.id === targetStageId)
          : { id: null, name: "Immediate Next Stage" }; // Simplified for immediate next

        if (meta?.handleOpenMoveQuantityModal) {
          meta.handleOpenMoveQuantityModal({
            id: item.id,
            sku: item.sku,
            currentQuantity: item.quantity,
            targetStageId: targetStageId,
            targetStageName:
              targetStage?.name ||
              (targetStageId
                ? `Stage ${targetStageId.substring(0, 6)}`
                : "Next Stage"),
          });
        }
      };

      const canMove = meta?.userRole === "Owner" || meta?.userRole === "Worker";
      const canRework = meta?.userRole === "Owner";
      const canAddRemark = canMove;

      // If no actions are possible at all, don't render the dropdown
      if (
        (!canMove || !hasNextStep) && // Can't move if no role OR no next step
        (!canRework || !hasPreviousStep) && // Can't rework if no role OR no prev step
        !canAddRemark // No remark permission
      ) {
        return null;
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={meta?.isMovingItems || meta?.isReworkingItems}
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {canMove && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  disabled={
                    // Disable if moving/reworking, or no next step
                    meta?.isMovingItems ||
                    meta?.isReworkingItems ||
                    !hasNextStep
                  }
                >
                  <ChevronsRight className="mr-2 h-4 w-4" />
                  <span>Move Forward</span>
                  {!hasNextStep && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (End of workflow)
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => handleOpenMoveModal()} // No targetStageId means immediate next
                      disabled={
                        // Disable if moving/reworking, or no next step
                        meta?.isMovingItems ||
                        meta?.isReworkingItems ||
                        !hasNextStep
                      }
                    >
                      Immediate Next Stage
                    </DropdownMenuItem>
                    {/* Render subsequent stages if available and there is a next step */}
                    {hasNextStep && (subsequentStages?.length ?? 0) > 0 && (
                      <DropdownMenuSeparator />
                    )}
                    {hasNextStep && isWorkflowLoading ? (
                      <DropdownMenuItem disabled>
                        Loading stages...
                      </DropdownMenuItem>
                    ) : hasNextStep && subsequentStages?.length ? (
                      subsequentStages?.map(
                        (stage: { id: string; name: string | null }) => (
                          <DropdownMenuItem
                            key={stage.id}
                            onClick={() => handleOpenMoveModal(stage.id)} // Pass targetStageId
                            disabled={
                              meta?.isMovingItems || meta?.isReworkingItems
                            }
                          >
                            {stage.name || `Stage ${stage.id.substring(0, 6)}`}
                          </DropdownMenuItem>
                        )
                      )
                    ) : null}{" "}
                    {/* Null if no subsequent stages or not hasNextStep */}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}
            {canRework && (
              <DropdownMenuItem
                onClick={handleOpenSingleItemRework}
                disabled={
                  // Disable if moving/reworking, or no previous step
                  meta?.isMovingItems ||
                  meta?.isReworkingItems ||
                  !hasPreviousStep
                }
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                <span>Rework Item</span>
                {!hasPreviousStep && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Start of workflow)
                  </span>
                )}
              </DropdownMenuItem>
            )}
            {canAddRemark && (
              <AddRemarkModal itemId={item.id}>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  disabled={meta?.isMovingItems || meta?.isReworkingItems}
                >
                  {" "}
                  {/* Prevent closing menu */}
                  Add Remark
                </DropdownMenuItem>
              </AddRemarkModal>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];

// --- Main Component --- //

interface ItemListTableProps {
  organizationId: string | undefined | null;
  stageId: string;
  subStageId: string | null;
}

// Define a type for the item details needed by the move quantity modal
interface ItemToMoveDetails {
  id: string;
  sku: string | null;
  currentQuantity: number;
  targetStageId?: string | null;
  targetStageName: string;
}

export function ItemListTable({
  organizationId: propOrganizationId,
  stageId,
  subStageId,
}: ItemListTableProps) {
  // --- State and Hook Initializations ---
  const {
    profile,
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();
  const userRole = profile?.role;

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedItemIdForHistory, setSelectedItemIdForHistory] = useState<
    string | null
  >(null);
  const [selectedItemSkuForHistory, setSelectedItemSkuForHistory] = useState<
    string | null
  >(null);

  // State for ItemDetailsModal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [selectedItemNameForDetails, setSelectedItemNameForDetails] = useState<
    string | null
  >(null);

  // State for MoveItemQuantityModal
  const [isMoveQuantityModalOpen, setIsMoveQuantityModalOpen] = useState(false);
  const [itemToMoveDetails, setItemToMoveDetails] =
    useState<ItemToMoveDetails | null>(null);

  // State for BulkMoveQuantityModal
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
  const [itemsForBulkMove, setItemsForBulkMove] = useState<ItemForBulkMove[]>(
    []
  );
  const [targetStageForBulkMove, setTargetStageForBulkMove] = useState<{
    id: string | null;
    name: string | null;
  } | null>(null);

  // State for SingleItemReworkQuantityModal
  const [isSingleReworkModalOpen, setIsSingleReworkModalOpen] = useState(false);
  const [itemForSingleRework, setItemForSingleRework] =
    useState<ItemForSingleRework | null>(null);

  // State for BulkReworkQuantityModal
  const [isBulkReworkModalOpen, setIsBulkReworkModalOpen] = useState(false);
  const [itemsForBulkRework, setItemsForBulkRework] = useState<
    ItemForBulkRework[]
  >([]);

  // Ref for ItemTableCore
  const itemTableCoreRef = React.useRef<ItemTableCoreHandles>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [orderIdFilter, setOrderIdFilter] = useState<string | null>(null);
  const debouncedOrderIdFilter = useDebounce(orderIdFilter, 500);

  const { data: workflowData, isLoading: isWorkflowLoading } =
    useWorkflowStructure(organizationId);

  const { mutate: moveItems, isPending: isMovingItems } = useMoveItemsForward();
  const { mutate: reworkItems, isPending: isReworkingItems } = useReworkItems();

  // --- Handler Functions and Memoized Calculations ---
  const handleViewHistory = (itemId: string, itemSku: string) => {
    setSelectedItemIdForHistory(itemId);
    setSelectedItemSkuForHistory(itemSku);
    setIsHistoryModalOpen(true);
  };

  const handleViewDetails = (
    details: Record<string, unknown>,
    itemName: string
  ) => {
    setSelectedItemDetails(details);
    setSelectedItemNameForDetails(itemName);
    setIsDetailsModalOpen(true);
  };

  const handleMoveForward = (
    itemsToMove: { id: string; quantity: number }[], // Updated signature
    targetStageId?: string | null // Add optional targetStageId
  ) => {
    console.log("hereee", itemsToMove, targetStageId);

    if (!organizationId) {
      // organizationId from useProfileAndOrg
      toast.error("Organization ID is missing. Cannot move items.");
      return;
    }
    moveItems(
      {
        items: itemsToMove, // Updated payload
        organizationId: organizationId, // organizationId from useProfileAndOrg
        targetStageId: targetStageId, // Pass it here
      },
      {
        onSuccess: () => {
          // rowSelection state will be reset by table instance if data re-fetches
          // and selected rows are no longer present, or manually:
          setRowSelection({});
        },
        onError: (error) => {
          // Error toast is handled by the mutation hook
          console.error("Failed to move items forward:", error);
        },
      }
    );
  };

  const handleReworkSuccess = () => {
    setRowSelection({}); // Clear selection after successful rework
  };

  const handleExportCsv = async () => {
    if (!organizationId) {
      // organizationId from useProfileAndOrg
      toast.error("Organization ID is missing. Cannot export items.");
      return;
    }
    const toastId = toast.loading("Generating CSV export...");
    try {
      const response = await fetch(
        // Use propOrganizationId if specifically for the current stage context, or hook's if general
        // Assuming stageId and subStageId from props are the context for export
        `/api/items/export?organizationId=${organizationId}&stageId=${stageId}` +
          (subStageId ? `&subStageId=${subStageId}` : "") +
          (debouncedOrderIdFilter ? `&orderId=${debouncedOrderIdFilter}` : "")
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate CSV");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `items_${stageId}_${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("CSV export generated successfully.", { id: toastId });
    } catch (error) {
      console.error("Export CSV error:", error);
      toast.error(`Export failed: ${(error as Error).message}`, {
        id: toastId,
      });
    }
  };

  const subsequentStages = React.useMemo(() => {
    if (!workflowData || isWorkflowLoading || !stageId) return [];
    return getSubsequentStages(workflowData, stageId, subStageId);
  }, [workflowData, isWorkflowLoading, stageId, subStageId]);

  const selectedItemsData = React.useMemo(() => {
    return [];
  }, [rowSelection]);
  /*
  // Example of how to get selected item IDs if table instance were here:
  // const selectedItemIds = table.getSelectedRowModel().flatRows.map(row => row.original.id);

  // If we need to pass the table instance or selected data up from ItemTableCore,
  // that would be a significant refactor. For now, bulk actions might need table instance.
  */

  const handleOpenMoveQuantityModal = (details: ItemToMoveDetails) => {
    setItemToMoveDetails(details);
    setIsMoveQuantityModalOpen(true);
  };

  const handleConfirmMoveItem = (itemId: string, quantity: number) => {
    if (!itemToMoveDetails) return; // Should not happen if modal was opened correctly
    handleMoveForward(
      [{ id: itemId, quantity: quantity }],
      itemToMoveDetails.targetStageId
    );
    setIsMoveQuantityModalOpen(false); // Close modal after initiating move
  };

  const handleOpenBulkMoveModal = (targetStage: {
    id: string;
    name: string | null;
  }) => {
    const selectedData = itemTableCoreRef.current?.getSelectedItemsData();
    if (selectedData && selectedData.length > 0) {
      const itemsToProcess: ItemForBulkMove[] = selectedData.map((item) => ({
        id: item.id,
        sku: item.sku,
        currentQuantity: item.quantity, // This is the total current quantity of the item
      }));
      setItemsForBulkMove(itemsToProcess);
      setTargetStageForBulkMove(targetStage);
      setIsBulkMoveModalOpen(true);
      setRowSelection({}); // Clear selection after initiating bulk modal opening
    } else {
      toast.info("No items selected or data unavailable.");
    }
  };

  const handleConfirmBulkMoveItems = (
    movedItems: { id: string; quantity: number }[],
    targetStageId: string | null
  ) => {
    handleMoveForward(movedItems, targetStageId);
    setIsBulkMoveModalOpen(false);
  };

  // --- Rework Handlers ---
  const handleOpenSingleReworkQuantityModal = (item: ItemForSingleRework) => {
    setItemForSingleRework(item);
    setIsSingleReworkModalOpen(true);
  };

  const handleConfirmSingleRework = (
    itemId: string,
    quantity: number,
    reason: string,
    targetStageId: string
  ) => {
    if (!organizationId) return;
    reworkItems(
      {
        items: [{ id: itemId, quantity }],
        rework_reason: reason,
        target_rework_stage_id: targetStageId,
        organizationId,
      },
      {
        onSuccess: () => {
          setIsSingleReworkModalOpen(false);
          setRowSelection({});
        },
        onError: () => setIsSingleReworkModalOpen(false),
      }
    );
  };

  const handleOpenBulkReworkModal = () => {
    const selectedData = itemTableCoreRef.current?.getSelectedItemsData();
    if (selectedData && selectedData.length > 0) {
      const itemsToProcess: ItemForBulkRework[] = selectedData.map((item) => ({
        id: item.id,
        sku: item.sku || null,
        currentQuantity: item.quantity,
        currentStageId: stageId,
        currentSubStageId: subStageId,
      }));
      setItemsForBulkRework(itemsToProcess);
      setIsBulkReworkModalOpen(true);
    } else {
      toast.info("No items selected for bulk rework.");
    }
  };

  const handleConfirmBulkRework = (
    reworkedItemsToSubmit: { id: string; quantity: number }[],
    reason: string,
    targetStageId: string
  ) => {
    if (!organizationId) return;
    reworkItems(
      {
        items: reworkedItemsToSubmit,
        rework_reason: reason,
        target_rework_stage_id: targetStageId,
        organizationId,
      },
      {
        onSuccess: () => {
          setIsBulkReworkModalOpen(false);
          setRowSelection({});
        },
        onError: () => setIsBulkReworkModalOpen(false),
      }
    );
  };

  // Handle loading and error states
  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Skeleton className="h-9 w-[300px]" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-[120px]" />
            <Skeleton className="h-9 w-[150px]" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="text-destructive p-4">
        Error loading user profile:{" "}
        {typeof authError === "string"
          ? authError
          : (authError as { message?: string })?.message || "Unknown error"}
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="text-destructive p-4">
        Organization ID is required to view items.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* --- Restore Filter Input and Export Button --- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder="Filter by Order ID..."
          value={orderIdFilter ?? ""}
          onChange={(event) => setOrderIdFilter(event.target.value)}
          className="max-w-sm text-sm h-9" // Adjusted height to h-9
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm" // Ensure consistent button size
            onClick={handleExportCsv}
            disabled={isMovingItems || isReworkingItems} // isMovingItems from useMoveItemsForward
            className="h-9" // Ensure button height matches input
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {/* --- Restore DropdownMenu for bulk actions --- */}
          {userRole === "Owner" &&
            subsequentStages &&
            subsequentStages.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      isMovingItems ||
                      isReworkingItems ||
                      Object.keys(rowSelection).length === 0
                    }
                    className="h-9" // Ensure button height matches input
                  >
                    Move Selected To <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Target Stage</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {subsequentStages.map((target) => (
                    <DropdownMenuItem
                      key={target.id}
                      onClick={
                        () => handleOpenBulkMoveModal(target) // Updated to open bulk modal
                      }
                      disabled={isMovingItems || isReworkingItems}
                    >
                      {target.name || target.id}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>
      </div>

      {/* --- Restore ItemTableCore --- */}
      <ItemTableCore
        ref={itemTableCoreRef} // Assign the ref
        organizationId={organizationId} // From useProfileAndOrg hook
        stageId={stageId} // From props
        subStageId={subStageId} // From props
        orderIdFilter={debouncedOrderIdFilter}
        columns={columns}
        userRole={userRole} // From useProfileAndOrg hook
        isMovingItems={isMovingItems} // From useMoveItemsForward hook
        isReworkingItems={isReworkingItems} // Pass rework loading state
        onViewHistory={handleViewHistory}
        onViewDetails={handleViewDetails} // Pass the new handler
        handleMoveForward={handleMoveForward}
        handleOpenSingleReworkQuantityModal={
          handleOpenSingleReworkQuantityModal
        } // Pass down the handler
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        workflowData={workflowData} // From useWorkflowStructure hook
        isWorkflowLoading={isWorkflowLoading} // From useWorkflowStructure hook
        currentStageId={stageId} // From props
        currentSubStageId={subStageId} // From props
        subsequentStages={subsequentStages}
        handleOpenMoveQuantityModal={handleOpenMoveQuantityModal} // Pass down the handler
      />

      {/* --- Restore ItemHistoryModal --- */}
      {selectedItemIdForHistory && (
        <ItemHistoryModal
          itemId={selectedItemIdForHistory}
          itemSku={selectedItemSkuForHistory}
          isOpen={isHistoryModalOpen}
          onOpenChange={setIsHistoryModalOpen}
        />
      )}

      {/* Item Details Modal */}
      {selectedItemDetails && (
        <ItemDetailsModal
          isOpen={isDetailsModalOpen}
          onOpenChange={setIsDetailsModalOpen}
          details={selectedItemDetails}
          itemName={selectedItemNameForDetails}
        />
      )}

      {/* Move Item Quantity Modal */}
      {itemToMoveDetails && (
        <MoveItemQuantityModal
          isOpen={isMoveQuantityModalOpen}
          onOpenChange={setIsMoveQuantityModalOpen}
          item={{
            id: itemToMoveDetails.id,
            sku: itemToMoveDetails.sku,
            currentQuantity: itemToMoveDetails.currentQuantity,
          }}
          targetStageName={itemToMoveDetails.targetStageName}
          onConfirmMove={handleConfirmMoveItem}
          userRole={userRole}
        />
      )}

      {/* Bulk Move Item Quantity Modal */}
      {targetStageForBulkMove && itemsForBulkMove.length > 0 && (
        <BulkMoveQuantityModal
          isOpen={isBulkMoveModalOpen}
          onOpenChange={setIsBulkMoveModalOpen}
          itemsToMove={itemsForBulkMove}
          targetStage={targetStageForBulkMove}
          onConfirmBulkMove={handleConfirmBulkMoveItems}
          isMovingItems={isMovingItems}
        />
      )}

      {/* Single Item Rework Quantity Modal */}
      {itemForSingleRework && (
        <SingleItemReworkQuantityModal
          isOpen={isSingleReworkModalOpen}
          onOpenChange={setIsSingleReworkModalOpen}
          item={{
            ...itemForSingleRework,
            currentStageId: stageId,
            currentSubStageId: subStageId,
          }}
          onConfirmRework={handleConfirmSingleRework}
          isProcessing={isReworkingItems}
          availableStages={workflowData || []}
        />
      )}

      {/* Bulk Rework Quantity Modal */}
      {itemsForBulkRework.length > 0 && (
        <BulkReworkQuantityModal
          isOpen={isBulkReworkModalOpen}
          onOpenChange={setIsBulkReworkModalOpen}
          itemsToRework={itemsForBulkRework.map((item) => ({
            ...item,
            currentStageId: stageId,
            currentSubStageId: subStageId,
          }))}
          onConfirmBulkRework={handleConfirmBulkRework}
          isProcessing={isReworkingItems}
          availableStages={workflowData || []}
        />
      )}
    </div>
  );
}

// Removed the old table rendering logic, useItemsInStage hook call, useReactTable hook call.
