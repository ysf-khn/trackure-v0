"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  getPaginationRowModel,
  RowSelectionState,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";
import {
  ItemInStage,
  useItemsInStage,
} from "@/hooks/queries/use-items-in-stage";
import { SingleItemReworkQuantityModal } from "@/components/items/single-item-rework-quantity-modal";
import { BulkReworkQuantityModal } from "@/components/items/bulk-rework-quantity-modal";
import { forwardRef, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { useReworkItems } from "@/hooks/mutations/use-rework-items";

// Re-define necessary types locally or import if centralized
interface ReworkableItem {
  id: string;
  current_stage_id: string;
  current_sub_stage_id?: string | null;
  display_name?: string;
  available_quantity: number;
}

interface ItemListTableMeta {
  onViewHistory?: (itemId: string, itemSku: string) => void;
  onViewDetails?: (details: Record<string, unknown>, itemName: string) => void;
  handleMoveForward: (
    itemsToMove: { id: string; quantity: number }[],
    targetStageId?: string | null,
    targetSubStageId?: string | null,
    sourceStageId?: string | null
  ) => void;
  isMovingItems: boolean;
  isReworkingItems: boolean;
  userRole?: string | null;
  workflowData?: FetchedWorkflowStage[];
  isWorkflowLoading: boolean;
  currentStageId: string;
  currentSubStageId: string | null;
  subsequentStages?: {
    id: string;
    name: string | null;
    isSubStage?: boolean;
    parentStageId?: string;
    parentStageName?: string | null;
  }[];
  handleOpenMoveQuantityModal?: (details: {
    id: string;
    sku: string | null;
    currentQuantity: number;
    targetStageId?: string | null;
    targetSubStageId?: string | null;
    targetStageName: string;
  }) => void;
  handleOpenSingleReworkQuantityModal?: (details: {
    id: string;
    sku: string | null;
    currentQuantity: number;
  }) => void;
  availableStagesForRework?: { id: string; name: string | null }[];
}

interface ItemTableCoreProps {
  organizationId: string | undefined | null;
  stageId: string;
  subStageId: string | null;
  orderIdFilter: string | null;
  columns: ColumnDef<ItemInStage>[]; // Pass columns definition
  // Pass state and handlers needed by the table meta/rendering
  userRole?: string | null;
  isMovingItems: boolean;
  isReworkingItems: boolean;
  onViewHistory: (itemId: string, itemSku: string) => void;
  onViewDetails: (details: Record<string, unknown>, itemName: string) => void;
  handleMoveForward: (
    itemsToMove: { id: string; quantity: number }[],
    targetStageId?: string | null,
    targetSubStageId?: string | null,
    sourceStageId?: string | null
  ) => void;
  // Ensure handleOpenMoveQuantityModal is defined only once
  handleOpenMoveQuantityModal?: (details: {
    id: string;
    sku: string | null;
    currentQuantity: number;
    targetStageId?: string | null;
    targetSubStageId?: string | null;
    targetStageName: string;
  }) => void;
  // Ensure handleOpenSingleReworkQuantityModal is defined only once
  handleOpenSingleReworkQuantityModal?: (item: {
    id: string;
    sku: string | null;
    currentQuantity: number;
    currentStageId: string;
    currentSubStageId: string | null;
  }) => void;
  // Add state setters for sorting/filtering/selection if managed outside
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: React.Dispatch<
    React.SetStateAction<ColumnFiltersState>
  >;
  rowSelection: RowSelectionState;
  onRowSelectionChange: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  // Add workflow data needed for meta
  workflowData?: FetchedWorkflowStage[];
  isWorkflowLoading: boolean;
  currentStageId: string;
  currentSubStageId: string | null;
  // Accept calculated subsequent stages
  subsequentStages?: {
    id: string;
    name: string | null;
    isSubStage?: boolean;
    parentStageId?: string;
    parentStageName?: string | null;
  }[];
}

// Define the interface for the functions exposed via ref
export interface ItemTableCoreHandles {
  getSelectedItemsData: () => ItemInStage[];
}

const ItemTableCore = forwardRef<ItemTableCoreHandles, ItemTableCoreProps>(
  (
    {
      organizationId,
      stageId,
      subStageId,
      orderIdFilter,
      columns,
      userRole,
      isMovingItems,
      isReworkingItems,
      onViewHistory,
      onViewDetails,
      handleMoveForward,
      handleOpenMoveQuantityModal,
      handleOpenSingleReworkQuantityModal,
      sorting,
      onSortingChange,
      columnFilters,
      onColumnFiltersChange,
      rowSelection,
      onRowSelectionChange,
      workflowData,
      isWorkflowLoading,
      currentStageId,
      currentSubStageId,
      subsequentStages,
    },
    ref
  ) => {
    // Fetch data based on props
    const {
      data: items,
      isLoading: isLoadingItems,
      isError: isItemsError,
      error: itemsError,
    } = useItemsInStage(organizationId, stageId, subStageId, orderIdFilter);

    // Single Item Rework Quantity Modal state
    const [isSingleReworkModalOpen, setIsSingleReworkModalOpen] =
      useState(false);
    const [itemForSingleRework, setItemForSingleRework] = useState<{
      id: string;
      sku: string | null;
      currentQuantity: number;
      currentStageId: string;
      currentSubStageId: string | null;
    } | null>(null);

    // Bulk Rework Quantity Modal state
    const [isBulkReworkModalOpen, setIsBulkReworkModalOpen] = useState(false);
    const [itemsForBulkRework, setItemsForBulkRework] = useState<
      {
        id: string;
        sku: string | null;
        currentQuantity: number;
        currentStageId: string;
        currentSubStageId: string | null;
      }[]
    >([]);

    const { mutate: reworkItems } = useReworkItems();

    // Create table instance
    const table = useReactTable<ItemInStage>({
      data: items ?? [],
      columns,
      onSortingChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      onColumnFiltersChange,
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      onRowSelectionChange,
      state: {
        sorting,
        columnFilters,
        rowSelection,
      },
      initialState: {
        pagination: {
          pageSize: 10,
        },
      },
      meta: {
        onViewHistory: onViewHistory,
        onViewDetails: onViewDetails,
        handleMoveForward: handleMoveForward,
        handleOpenSingleReworkQuantityModal:
          handleOpenSingleReworkQuantityModal,
        isMovingItems: isMovingItems,
        isReworkingItems: isReworkingItems,
        userRole: userRole,
        workflowData: workflowData,
        isWorkflowLoading: isWorkflowLoading,
        currentStageId: currentStageId,
        currentSubStageId: currentSubStageId,
        subsequentStages: subsequentStages,
        handleOpenMoveQuantityModal: handleOpenMoveQuantityModal,
      } as ItemListTableMeta,
      enableRowSelection: true,
    });

    // Expose a function to get selected items data via ref
    useImperativeHandle(ref, () => ({
      getSelectedItemsData: () => {
        return table.getSelectedRowModel().flatRows.map((row) => row.original);
      },
    }));

    const handleConfirmSingleRework = (
      itemId: string,
      quantity: number,
      reason: string,
      targetStageId: string,
      targetSubStageId: string | null
    ) => {
      if (!organizationId) return;
      reworkItems(
        {
          items: [
            {
              id: itemId,
              quantity,
              source_stage_id: currentStageId,
              source_sub_stage_id: currentSubStageId,
            },
          ],
          rework_reason: reason,
          target_rework_stage_id: targetStageId,
          target_rework_sub_stage_id: targetSubStageId,
          organizationId,
        },
        {
          onSuccess: () => {
            setIsSingleReworkModalOpen(false);
            setItemForSingleRework(null);
          },
          onError: (error: Error) => {
            console.error("Rework error:", error);
            toast.error("Failed to process rework");
          },
        }
      );
    };

    const handleConfirmBulkRework = (
      reworkedItems: { id: string; quantity: number }[],
      reason: string,
      targetStageId: string,
      targetSubStageId: string | null
    ) => {
      if (!organizationId) return;
      reworkItems(
        {
          items: reworkedItems.map((item) => ({
            ...item,
            source_stage_id: currentStageId,
            source_sub_stage_id: currentSubStageId,
          })),
          rework_reason: reason,
          target_rework_stage_id: targetStageId,
          target_rework_sub_stage_id: targetSubStageId,
          organizationId,
        },
        {
          onSuccess: () => {
            setIsBulkReworkModalOpen(false);
            setItemsForBulkRework([]);
          },
          onError: (error: Error) => {
            console.error("Rework error:", error);
            toast.error("Failed to process rework");
          },
        }
      );
    };

    // Loading state
    if (isLoadingItems) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (isItemsError) {
      let displayError = "Error loading items: Unknown error";
      if (itemsError?.message) {
        if (itemsError.message.includes("invalid input syntax for type uuid")) {
          displayError =
            "Invalid Order ID format. Please check the ID and try again.";
        } else {
          displayError = `Error loading items: ${itemsError.message}`;
        }
      }
      return <div className="text-destructive p-4">{displayError}</div>;
    }

    return (
      <>
        {/* Table */}
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className="bg-muted/50 first:rounded-tl-md last:rounded-tr-md"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No items found matching the criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination Controls */}
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || isMovingItems}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || isMovingItems}
          >
            Next
          </Button>
        </div>
        {/* Single Item Rework Quantity Modal */}
        {itemForSingleRework && (
          <SingleItemReworkQuantityModal
            isOpen={isSingleReworkModalOpen}
            onOpenChange={setIsSingleReworkModalOpen}
            item={itemForSingleRework}
            onConfirmRework={handleConfirmSingleRework}
            isProcessing={isReworkingItems}
            availableStages={
              workflowData?.map((stage) => ({
                id: stage.id,
                name: stage.name,
                sequence_order: stage.sequence_order,
                sub_stages: stage.sub_stages,
              })) || []
            }
            userRole={userRole}
          />
        )}
        {/* Bulk Rework Quantity Modal */}
        {itemsForBulkRework.length > 0 && (
          <BulkReworkQuantityModal
            isOpen={isBulkReworkModalOpen}
            onOpenChange={setIsBulkReworkModalOpen}
            itemsToRework={itemsForBulkRework}
            onConfirmBulkRework={handleConfirmBulkRework}
            isProcessing={isReworkingItems}
            availableStages={
              workflowData?.map((stage) => ({
                id: stage.id,
                name: stage.name,
                sequence_order: stage.sequence_order,
                sub_stages: stage.sub_stages,
              })) || []
            }
            userRole={userRole}
          />
        )}
      </>
    );
  }
);

ItemTableCore.displayName = "ItemTableCore";

export { ItemTableCore };
