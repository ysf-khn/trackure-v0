"use client";

import * as React from "react";
import { useState, useMemo, useRef } from "react";
import {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  Table as ReactTable, // For getting table instance
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner"; // Import toast
import { DateRange } from "react-day-picker";
import Link from "next/link"; // Add this import

import {
  ChevronRight,
  History,
  Download,
  ChevronsRight, // Icon for submenu
  Info, // Import the Info icon
  RotateCcw, // Icon for Rework
  FileText, // Icon for PDF
  ExternalLink, // Add this import
  Trash2, // Import the Trash icon
  Layers, // Icon for composite items
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useMultiplePermissions } from "@/hooks/queries/use-permission-check";

// --- Types --- //

interface ItemForSingleRework {
  id: string;
  sku: string | null;
  currentQuantity: number;
  currentStageId: string;
  entryType?: "normal" | "reworked";
}

interface ItemToMoveDetails {
  id: string;
  sku: string | null;
  currentQuantity: number;
  targetStageId?: string | null;
  targetStageName: string;
  entryType?: "normal" | "reworked";
}

interface ItemListTableMeta {
  onViewHistory?: (itemId: string, itemSku: string) => void;
  onViewDetails?: (
    item: {
      id: string;
      sku: string;
      instance_details: Record<string, unknown>;
      composite_group_id?: string | null;
      parent_composite_sku?: string | null;
    },
    itemName: string
  ) => void;
  handleMoveForward: (
    itemsToMove: { id: string; quantity: number }[],
    targetStageId?: string | null,
    sourceStageId?: string | null
  ) => void;
  handleOpenSingleReworkQuantityModal?: (item: ItemForSingleRework) => void;
  isMovingItems: boolean;
  isReworkingItems: boolean;
  userRole?: string | null;
  workflowData?: FetchedWorkflowStage[];
  isWorkflowLoading: boolean;
  currentStageId: string;
  subsequentStages?: {
    id: string;
    name: string | null;
    parentStageId?: string;
    parentStageName?: string | null;
  }[];
  handleOpenMoveQuantityModal?: (details: ItemToMoveDetails) => void;
  hasPermission: (permissionKey: string) => boolean;
  handleDeleteItem?: (itemId: string) => void;
}

interface ItemListTableProps {
  organizationId: string | undefined | null;
  stageId: string;
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
          className="data-[state=checked]:text-white data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:hover:bg-primary/90"
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
          className="data-[state=checked]:text-white data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:hover:bg-primary/90"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as ItemListTableMeta | undefined;

      // Extract necessary info from meta
      const { workflowData, currentStageId } = meta || {};

      // Determine if there are previous steps
      const hasPreviousStep =
        workflowData && currentStageId
          ? determinePreviousStage(currentStageId, null, workflowData) !== null
          : false;

      const handleOpenSingleItemRework = () => {
        if (meta?.handleOpenSingleReworkQuantityModal && meta.currentStageId) {
          meta.handleOpenSingleReworkQuantityModal({
            id: item.source_item_id,
            sku: item.sku,
            currentQuantity: item.quantity,
            currentStageId: meta.currentStageId,
            entryType: item.entry_type,
          });
        }
      };

      const canRework = meta?.hasPermission("items.move") ?? false;
      const canAddRemark = meta?.hasPermission("items.view") ?? false;
      const canDelete = meta?.hasPermission("items.delete") ?? false;

      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {row.getValue("sku")}
          </span>
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-6 w-6 p-0 hover:bg-primary/10"
            >
              <Link href={`/items/${item.source_item_id}`}>
                <ExternalLink className="h-3 w-3" />
                <span className="sr-only">View item details</span>
              </Link>
            </Button>
            {canRework && hasPreviousStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenSingleItemRework}
                disabled={
                  meta?.isMovingItems ||
                  meta?.isReworkingItems ||
                  !hasPreviousStep
                }
                className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="sr-only">Rework item</span>
              </Button>
            )}
            {canAddRemark && (
              <AddRemarkModal itemId={item.source_item_id}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={meta?.isMovingItems || meta?.isReworkingItems}
                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                >
                  <FileText className="h-3 w-3" />
                  <span className="sr-only">Add remark</span>
                </Button>
              </AddRemarkModal>
            )}
            {canDelete && (
              <>
                <div className="w-px h-4 bg-border mx-1.5" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (
                      confirm(
                        `Are you sure you want to delete item ${item.sku}? This action cannot be undone.`
                      )
                    ) {
                      meta?.handleDeleteItem?.(item.source_item_id);
                    }
                  }}
                  disabled={meta?.isMovingItems || meta?.isReworkingItems}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="sr-only">Delete item</span>
                </Button>
              </>
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: "entry_type",
    header: "Type",
    cell: ({ row }) => {
      const item = row.original;

      // Show entry type (normal/reworked) with appropriate styling
      if (item.entry_type === "reworked") {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <span className="text-xs text-amber-800 bg-amber-100 px-2 py-1 rounded-md border border-amber-200 font-medium">
                    Reworked
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm max-w-xs">
                  <p>
                    <strong>Entry Type:</strong> Reworked quantities
                  </p>
                  {item.rework_reasons && item.rework_reasons.length > 0 && (
                    <>
                      <p className="mt-2">
                        <strong>Rework Reasons:</strong>
                      </p>
                      <ul className="list-disc list-inside">
                        {item.rework_reasons.map((reason, index) => (
                          <li key={index}>{reason}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // Show composite info for normal entries if applicable
      if (item.parent_composite_sku) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md font-medium">
                    Component
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p>
                    <strong>Component of:</strong> {item.parent_composite_sku}
                  </p>
                  <p>
                    <strong>Group ID:</strong>{" "}
                    {item.composite_group_id?.slice(0, 8)}...
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return (
        <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md font-medium">
          Normal
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "order_number",
    header: "Order Number",
    cell: ({ row }) => (
      <div className="font-medium text-muted-foreground">
        {row.getValue("order_number")}
      </div>
    ),
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => {
      const quantity = row.getValue("quantity") as number;
      return <div className="font-semibold text-foreground">{quantity}</div>;
    },
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
          variant="ghost"
          size="sm"
          onClick={() =>
            meta.onViewDetails?.(
              {
                id: row.original.source_item_id,
                sku: row.original.sku,
                instance_details: details,
                composite_group_id: row.original.composite_group_id,
                parent_composite_sku: row.original.parent_composite_sku,
              },
              itemName
            )
          }
          disabled={meta.isMovingItems || meta.isReworkingItems}
          aria-label="View Item Details"
          className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Info className="h-3 w-3 mr-2" />
          Details
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
            {formatDistanceToNow(new Date(enteredAt), { addSuffix: false })}
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
          variant="ghost"
          size="sm"
          onClick={() => meta.onViewHistory?.(item.source_item_id, item.sku)}
          disabled={meta.isMovingItems || meta.isReworkingItems}
          aria-label="View Item History"
          className="h-8 px-3 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
        >
          <History className="h-3 w-3 mr-2" />
          History
        </Button>
      );
    },
    enableSorting: false,
  },
  {
    id: "voucher",
    header: () => (
      <div className="flex items-center gap-1">
        <span>Voucher</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Download the latest movement voucher for the current item's
                quantity that has reached this stage.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
    cell: ({ row, table }) => {
      const item = row.original as ItemInStage & {
        current_stage_history_id?: string;
      };
      const meta = table.options.meta as ItemListTableMeta | undefined;
      const canDownload =
        (meta?.hasPermission("documents.vouchers") ?? false) &&
        !!item.current_stage_history_id;

      if (!canDownload) {
        return null; // Or a placeholder/disabled button
      }

      return (
        <Button
          variant="ghost"
          size="sm"
          asChild
          disabled={meta?.isMovingItems || meta?.isReworkingItems}
          aria-label="Download Voucher for this Stage"
          className="h-7 px-2.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
        >
          <a
            href={`/api/vouchers/${item.id}?history_id=${item.current_stage_history_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5"
          >
            <Download className="h-3 w-3" />
            Voucher
          </a>
        </Button>
      );
    },
    enableSorting: false,
  },
  {
    id: "move_forward",
    header: "Move Forward",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as ItemListTableMeta | undefined;

      // Extract necessary info from meta
      const {
        subsequentStages,
        isWorkflowLoading,
        workflowData,
        currentStageId,
      } = meta || {};

      // Determine if there are next steps
      const nextStage =
        workflowData && currentStageId
          ? determineNextStage(currentStageId, null, workflowData)
          : null;

      const hasNextStep = nextStage !== null;

      // Debug logging
      if (workflowData && currentStageId) {
        console.log(
          `[MoveForward] Stage ${currentStageId}, workflow stages:`,
          workflowData.length,
          "nextStage:",
          nextStage,
          "hasNextStep:",
          hasNextStep
        );
      }

      const handleOpenMoveModal = (targetId?: string | null) => {
        let targetStageId: string | null = null;
        let targetStageName: string;

        if (!targetId) {
          // Immediate next stage
          targetStageName = "Immediate Next Stage";
        } else {
          // Find the target in subsequent stages
          const targetStage = subsequentStages?.find((s) => s.id === targetId);

          if (targetStage) {
            targetStageId = targetId;
            targetStageName =
              targetStage.name || `Stage ${targetId.substring(0, 6)}`;
          } else {
            // Fallback
            targetStageId = targetId;
            targetStageName = `Stage ${targetId.substring(0, 6)}`;
          }
        }

        if (meta?.handleOpenMoveQuantityModal) {
          meta.handleOpenMoveQuantityModal({
            id: item.source_item_id,
            sku: item.sku,
            currentQuantity: item.quantity,
            targetStageId: targetStageId,
            targetStageName: targetStageName,
            entryType: item.entry_type, // Pass the entry type (normal/reworked)
          });
        }
      };

      const canMove = meta?.hasPermission("items.move") ?? false;

      // If user can't move items or there's no next step, don't show anything
      if (!canMove || !hasNextStep) {
        if (!hasNextStep) {
          return (
            <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted/30 rounded-md">
              End of workflow
            </span>
          );
        }
        return null;
      }

      // If there's only immediate next stage or no subsequent stages, show simple button
      if (!subsequentStages || subsequentStages.length === 0) {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenMoveModal()}
            disabled={meta?.isMovingItems || meta?.isReworkingItems}
            className="h-7 px-2.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
          >
            <ChevronsRight className="mr-1.5 h-3 w-3" />
            Move Forward
          </Button>
        );
      }

      // If there are multiple subsequent stages, show dropdown
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={meta?.isMovingItems || meta?.isReworkingItems}
              className="h-7 px-2.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
            >
              <ChevronsRight className="mr-1.5 h-3 w-3" />
              Move Forward
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleOpenMoveModal()} // No targetStageId means immediate next
              disabled={meta?.isMovingItems || meta?.isReworkingItems}
            >
              Immediate Next Stage
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isWorkflowLoading ? (
              <DropdownMenuItem disabled>Loading stages...</DropdownMenuItem>
            ) : (
              subsequentStages?.map(
                (stage: { id: string; name: string | null }) => (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => handleOpenMoveModal(stage.id)} // Pass targetStageId
                    disabled={meta?.isMovingItems || meta?.isReworkingItems}
                  >
                    {stage.name || `Stage ${stage.id.substring(0, 6)}`}
                  </DropdownMenuItem>
                )
              )
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

export function ItemListTable({
  organizationId: propOrganizationId,
  stageId,
}: ItemListTableProps) {
  // --- State and Hook Initializations ---
  const queryClient = useQueryClient();
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
  const [selectedItemDetails, setSelectedItemDetails] = useState<{
    id: string;
    sku: string;
    instance_details: Record<string, unknown>;
    composite_group_id?: string | null;
    parent_composite_sku?: string | null;
  } | null>(null);
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

  // State for PDF export modal and date range picker
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // We need to get the SKU from items in the current stage to fetch the correct workflow
  // Since all items in a stage have the same SKU, we can use any item's SKU
  // We'll get this from the ItemTableCore component through a ref
  const [currentStageSKU, setCurrentStageSKU] = useState<string | null>(null);

  // Use workflow structure with the detected SKU from current stage items
  const { data: workflowData, isLoading: isWorkflowLoading } =
    useWorkflowStructure(organizationId, currentStageSKU);

  // Debug logging for workflow data
  React.useEffect(() => {
    if (workflowData && currentStageSKU) {
      console.log(
        `[ItemListTable] Loaded workflow for SKU ${currentStageSKU}:`,
        workflowData.length,
        "stages"
      );
    }
  }, [workflowData, currentStageSKU]);

  // Effect to detect and update the current stage SKU when items load
  React.useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Check for SKU periodically until we get one
    if (!currentStageSKU) {
      intervalId = setInterval(() => {
        if (itemTableCoreRef.current) {
          const detectedSKU = itemTableCoreRef.current.getCurrentStageSKU();
          if (detectedSKU && detectedSKU !== currentStageSKU) {
            console.log(
              `[ItemListTable] Detected SKU for stage ${stageId}: ${detectedSKU}`
            );
            setCurrentStageSKU(detectedSKU);
          }
        }
      }, 100); // Check every 100ms
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentStageSKU, stageId]); // Re-run when currentStageSKU changes

  const { mutate: moveItems, isPending: isMovingItems } = useMoveItemsForward();
  const { mutate: reworkItems, isPending: isReworkingItems } = useReworkItems();

  // Get all permissions we need for this component in one call
  const permissionsToCheck = [
    "items.move",
    "items.add",
    "items.view",
    "items.delete",
    "documents.export",
    "documents.vouchers",
    "documents.history",
  ];
  const permissions = useMultiplePermissions(permissionsToCheck);

  // Create hasPermission function for backward compatibility
  const hasPermission = (permissionKey: string): boolean => {
    return permissions[permissionKey] || false;
  };

  // --- Handler Functions and Memoized Calculations ---
  const handleViewHistory = (itemId: string, itemSku: string) => {
    setSelectedItemIdForHistory(itemId);
    setSelectedItemSkuForHistory(itemSku);
    setIsHistoryModalOpen(true);
  };

  const handleViewDetails = (
    item: {
      id: string;
      sku: string;
      instance_details: Record<string, unknown>;
      composite_group_id?: string | null;
      parent_composite_sku?: string | null;
    },
    itemName: string
  ) => {
    setSelectedItemDetails(item);
    setSelectedItemNameForDetails(itemName);
    setIsDetailsModalOpen(true);
  };

  const handleMoveForward = (
    itemsToMove: { id: string; quantity: number }[], // Updated signature
    targetStageId?: string | null, // Add optional targetStageId
    sourceStageId?: string | null // Add optional sourceStageId
  ) => {
    if (!organizationId) {
      // organizationId from useProfileAndOrg
      toast.error("Organization ID is missing. Cannot move items.");
      return;
    }

    const mutationPayload = {
      items: itemsToMove, // Updated payload
      organizationId: organizationId, // organizationId from useProfileAndOrg
      targetStageId: targetStageId, // Pass it here
      sourceStageId: sourceStageId || stageId, // Use provided sourceStageId or current stageId
    };

    moveItems(mutationPayload, {
      onSuccess: () => {
        // rowSelection state will be reset by table instance if data re-fetches
        // and selected rows are no longer present, or manually:
        setRowSelection({});
      },
      onError: (error) => {
        // Error toast is handled by the mutation hook
        console.error("Failed to move items forward:", error);
      },
    });
  };

  const handleReworkSuccess = () => {
    setRowSelection({}); // Clear selection after successful rework
  };

  const handleOpenPdfExportModal = () => {
    setIsPdfExportModalOpen(true);
  };

  const handleExportPdf = async (selectedDateRange?: DateRange) => {
    if (!organizationId) {
      toast.error("Organization ID is missing. Cannot export items.");
      return;
    }

    setIsExportingPdf(true);
    const toastId = toast.loading("Generating PDF export...");

    try {
      // Build query parameters
      const params = new URLSearchParams({
        organizationId: organizationId,
        stageId: stageId,
      });

      if (debouncedOrderIdFilter) {
        params.append("orderId", debouncedOrderIdFilter);
      }

      // Add date range parameters if selected
      if (selectedDateRange?.from) {
        params.append("startDate", selectedDateRange.from.toISOString());
      }
      if (selectedDateRange?.to) {
        params.append("endDate", selectedDateRange.to.toISOString());
      }

      const response = await fetch(
        `/api/items/export-pdf?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `items_export_report_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("PDF export generated successfully.", { id: toastId });

      // Close modal and reset state
      setIsPdfExportModalOpen(false);
      setDateRange(undefined);
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error(`Export failed: ${(error as Error).message}`, {
        id: toastId,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Note: subsequentStages will now be calculated per-item based on their SKU
  // This is a fallback for general workflow structure when no specific SKU is available
  const subsequentStages = React.useMemo(() => {
    if (!workflowData || isWorkflowLoading || !stageId) return [];
    return getSubsequentStages(workflowData, stageId, null);
  }, [workflowData, isWorkflowLoading, stageId]);

  const selectedItemsData = React.useMemo(() => {
    return [];
  }, [rowSelection]);

  const handleOpenMoveQuantityModal = (details: ItemToMoveDetails) => {
    setItemToMoveDetails(details);
    setIsMoveQuantityModalOpen(true);
  };

  const handleConfirmMoveItem = (itemId: string, quantity: number) => {
    if (!itemToMoveDetails) return; // Should not happen if modal was opened correctly

    handleMoveForward(
      [{ id: itemId, quantity: quantity }],
      itemToMoveDetails.targetStageId,
      stageId
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
    handleMoveForward(movedItems, targetStageId, stageId);
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
    targetStageId: string,
    sourceStageId: string
  ) => {
    if (!organizationId) return;
    reworkItems(
      {
        items: [
          {
            id: itemId,
            quantity,
            source_stage_id: sourceStageId,
          },
        ],
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
    if (selectedData && selectedData.length > 0 && stageId) {
      const itemsToProcess: ItemForBulkRework[] = selectedData.map((item) => ({
        id: item.id,
        sku: item.sku || null,
        currentQuantity: item.quantity,
        currentStageId: stageId,
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
    // Prepare the items for the rework API
    const itemsToRework = reworkedItemsToSubmit.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      source_stage_id: stageId,
    }));

    // Call the rework mutation
    reworkItems(
      {
        items: itemsToRework,
        rework_reason: reason,
        target_rework_stage_id: targetStageId,
        organizationId: organizationId!,
      },
      {
        onSuccess: () => {
          setIsBulkReworkModalOpen(false);
          setItemsForBulkRework([]);
          setRowSelection({});
        },
        onError: () => setIsBulkReworkModalOpen(false),
      }
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete item");
      }

      toast.success("Item deleted successfully");

      // Refresh the table data
      itemTableCoreRef.current?.refetch();

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["itemsInStage", organizationId],
      });
      queryClient.invalidateQueries({ queryKey: ["workflow", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["newItemsCount"] });
      queryClient.invalidateQueries({ queryKey: ["completedItemsCount"] });
      queryClient.invalidateQueries({
        queryKey: ["stage-item-counts", organizationId],
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete item"
      );
    }
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
      {/* --- Updated Filter Input and Export Button --- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder="Filter by Order ID..."
          value={orderIdFilter ?? ""}
          onChange={(event) => setOrderIdFilter(event.target.value)}
          className="max-w-sm text-sm h-9"
        />
        <div className="flex gap-2 items-center">
          {hasPermission("documents.export") && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenPdfExportModal}
              disabled={isMovingItems || isReworkingItems}
              className="h-9"
            >
              <FileText className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          )}
          {/* --- Restore DropdownMenu for bulk actions --- */}
          {hasPermission("items.move") &&
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
                    className="h-9"
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
                      onClick={() => handleOpenBulkMoveModal(target)}
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

      {/* --- PDF Export Modal --- */}
      <Dialog
        open={isPdfExportModalOpen}
        onOpenChange={setIsPdfExportModalOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Items to PDF</DialogTitle>
            <DialogDescription>
              Choose a date range to filter items by when they entered the
              current stage. Leave empty to export all items in this stage.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPdfExportModalOpen(false);
                setDateRange(undefined);
              }}
              disabled={isExportingPdf}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => handleExportPdf(dateRange)}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? "Generating..." : "Export PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Restore ItemTableCore --- */}
      <ItemTableCore
        ref={itemTableCoreRef} // Assign the ref
        organizationId={organizationId} // From useProfileAndOrg hook
        stageId={stageId} // From props
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
        subsequentStages={subsequentStages}
        handleOpenMoveQuantityModal={handleOpenMoveQuantityModal} // Pass down the handler
        hasPermission={hasPermission} // Pass permission check function
        handleDeleteItem={handleDeleteItem} // Pass delete handler
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
          item={selectedItemDetails}
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
          targetStageId={itemToMoveDetails.targetStageId}
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
          userRole={userRole}
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
          }}
          onConfirmRework={handleConfirmSingleRework}
          isProcessing={isReworkingItems}
          workflowData={workflowData}
          userRole={userRole}
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
          }))}
          onConfirmBulkRework={handleConfirmBulkRework}
          isProcessing={isReworkingItems}
          availableStages={workflowData || []}
          userRole={userRole}
        />
      )}
    </div>
  );
}

// Removed the old table rendering logic, useItemsInStage hook call, useReactTable hook call.
