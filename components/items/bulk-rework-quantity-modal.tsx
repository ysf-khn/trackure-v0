"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // For rework reason
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ItemForBulkRework {
  id: string;
  sku?: string | null;
  currentQuantity: number;
  currentStageId: string;
  currentSubStageId: string | null;
}

interface BulkReworkQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  itemsToRework: ItemForBulkRework[];
  availableStages: {
    id: string;
    name: string | null;
    sequence_order: number;
    sub_stages?: {
      id: string;
      name: string | null;
      sequence_order: number;
    }[];
  }[];
  onConfirmBulkRework: (
    reworkedItems: { id: string; quantity: number }[],
    reason: string,
    targetStageId: string,
    targetSubStageId: string | null
  ) => void;
  isProcessing: boolean;
  userRole?: string | null;
}

export function BulkReworkQuantityModal({
  isOpen,
  onOpenChange,
  itemsToRework,
  availableStages,
  onConfirmBulkRework,
  isProcessing,
  userRole,
}: BulkReworkQuantityModalProps) {
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {}
  );
  const [reworkReason, setReworkReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [downloadVouchers, setDownloadVouchers] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens
      const initialQuantities: Record<string, number> = {};
      itemsToRework.forEach((item) => {
        initialQuantities[item.id] = 1;
      });
      setItemQuantities(initialQuantities);
      setReworkReason("");
      setReasonError(null);
      setSelectedStageId(availableStages[0]?.id || "");
      setDownloadVouchers(false); // Reset voucher option
    }
  }, [isOpen, itemsToRework, availableStages]);

  const handleSubmit = async () => {
    // Validate quantities and reason
    let canSubmit = true;
    let itemsToSubmit: { id: string; quantity: number }[] = [];

    // Check each item's quantity
    itemsToRework.forEach((item) => {
      const quantity = itemQuantities[item.id] || 0;
      if (quantity <= 0 || quantity > item.currentQuantity) {
        canSubmit = false;
        return;
      }
      itemsToSubmit.push({ id: item.id, quantity });
    });

    // Check reason
    if (reworkReason.trim().length < 3) {
      canSubmit = false;
    }

    // Check target stage
    if (!selectedStageId) {
      toast.error("Please select a target stage for rework.");
      return;
    }

    if (!canSubmit) {
      toast.error("Please correct any errors before submitting.");
      return;
    }

    // Find the selected stage/substage in the available stages
    let targetStageId = selectedStageId;
    let targetStageIdForVoucher = selectedStageId; // For voucher generation
    let isSubStage = false;

    // Look through all stages and their substages to find the selected ID
    for (const stage of availableStages) {
      if (stage.id === selectedStageId) {
        // It's a main stage
        targetStageId = selectedStageId;
        targetStageIdForVoucher = selectedStageId;
        break;
      }
      // Check substages
      if (stage.sub_stages) {
        const foundSubStage = stage.sub_stages.find(
          (sub) => sub.id === selectedStageId
        );
        if (foundSubStage) {
          // It's a substage, use the parent stage's ID for rework operation
          targetStageId = stage.id;
          // But use the actual sub-stage ID for voucher
          targetStageIdForVoucher = selectedStageId;
          isSubStage = true;
          break;
        }
      }
    }

    onConfirmBulkRework(
      itemsToSubmit,
      reworkReason.trim(),
      targetStageId,
      isSubStage ? selectedStageId : null
    );

    // Download vouchers if user is Owner AND they chose to download
    console.log(
      `[VoucherDebug] handleSubmit: Checking userRole. Value: '${userRole}' (Type: ${typeof userRole})`
    );
    console.log(
      `[VoucherDebug] handleSubmit: downloadVouchers: ${downloadVouchers}`
    );

    if (userRole === "Owner" && downloadVouchers) {
      console.log(
        "[VoucherDebug] handleSubmit: Voucher download condition met."
      );
      console.log(
        "[VoucherDebug] handleSubmit: itemsToRework:",
        JSON.stringify(
          itemsToRework.map((item) => ({ id: item.id, sku: item.sku }))
        )
      );

      if (!itemsToRework || itemsToRework.length === 0) {
        console.warn(
          "[VoucherDebug] handleSubmit: itemsToRework is empty or undefined. No vouchers to download."
        );
      } else {
        try {
          console.log(
            "[VoucherDebug] handleSubmit: Entering voucher download try block."
          );
          // Download vouchers for each item
          for (const item of itemsToRework) {
            console.log(
              `[VoucherDebug] handleSubmit: Processing item ${item.id} (SKU: ${item.sku}) for voucher download.`
            );
            const response = await fetch(`/api/vouchers/${item.id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                quantity: itemQuantities[item.id] || 1,
                targetStageId: targetStageIdForVoucher,
                isRework: true,
                reworkReason: reworkReason.trim(),
              }),
            });
            console.log(
              `[VoucherDebug] handleSubmit: Fetch response for item ${item.id} - Status: ${response.status}, OK: ${response.ok}`
            );

            if (!response.ok) {
              let errorBody = "Could not read error body";
              try {
                errorBody = await response.text();
              } catch (e) {
                /* ignore */
              }
              console.error(
                `[VoucherDebug] handleSubmit: Failed to fetch voucher for item ${item.id}. Status: ${response.status}. Body: ${errorBody}`
              );
              throw new Error(
                `Failed to generate voucher for item ${item.id}. Status: ${response.status}`
              );
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `rework_voucher_${item.sku || item.id}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
            document.body.appendChild(a);
            a.click();
            console.log(
              `[VoucherDebug] handleSubmit: Voucher download triggered for item ${item.id}.`
            );
            window.URL.revokeObjectURL(url);
            a.remove();
            // Add a small delay between downloads to prevent browser issues
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          console.log(
            "[VoucherDebug] handleSubmit: All vouchers processed successfully."
          );
        } catch (error) {
          console.error(
            "[VoucherDebug] handleSubmit: Error during voucher download process:",
            error
          );
          toast.error(
            "Failed to download one or more rework vouchers. Check console for details."
          );
        }
      }
    } else {
      console.log(
        `[VoucherDebug] handleSubmit: Voucher download condition NOT met. User role: '${userRole}' (Type: ${typeof userRole}) - was not "Owner" or downloadVouchers was ${downloadVouchers}.`
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send Selected Items for Rework</DialogTitle>
          <DialogDescription>
            Specify quantity for each item and provide a common rework reason.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="target-stage" className="text-right">
              Target Stage
            </Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select target stage" />
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name || stage.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-y-3 gap-x-4 py-1">
            <Label htmlFor="bulk-rework-reason" className="mt-3 mb-1">
              Common Rework Reason
            </Label>
            <Textarea
              id="bulk-rework-reason"
              value={reworkReason}
              onChange={(e) => {
                setReworkReason(e.target.value);
                if (e.target.value.trim().length < 3) {
                  setReasonError("Reason must be at least 3 characters long.");
                } else {
                  setReasonError(null);
                }
              }}
              placeholder="Describe why these items need rework... (min 3 chars)"
              className={`min-h-[80px] ${reasonError ? "border-destructive" : ""}`}
            />
            {reasonError && (
              <p className="text-sm text-destructive pl-1">{reasonError}</p>
            )}
          </div>

          {userRole === "Owner" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="download-bulk-rework-vouchers"
                checked={downloadVouchers}
                onCheckedChange={(checked) =>
                  setDownloadVouchers(checked as boolean)
                }
              />
              <Label
                htmlFor="download-bulk-rework-vouchers"
                className="text-sm font-normal"
              >
                Download rework vouchers for all items
              </Label>
            </div>
          )}

          <DialogDescription className="mt-3 mb-1 font-medium">
            Items to Rework:
          </DialogDescription>
          <ScrollArea className="max-h-[40vh]">
            <div className="grid gap-4 py-1 pr-1">
              {itemsToRework.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-3 items-center gap-x-4 gap-y-1 py-2 border-b last:border-b-0"
                >
                  <Label
                    htmlFor={`rework-quantity-${item.id}`}
                    className="col-span-3 text-sm font-medium truncate"
                  >
                    {item.sku || item.id} (Avail: {item.currentQuantity})
                  </Label>
                  <Input
                    id={`rework-quantity-${item.id}`}
                    type="number"
                    value={
                      itemQuantities[item.id] === 0 && reasonError
                        ? ""
                        : itemQuantities[item.id] || ""
                    }
                    onChange={(e) => {
                      const numValue = parseInt(e.target.value);
                      if (isNaN(numValue) || numValue <= 0) {
                        setReasonError("Quantity must be a positive number.");
                        setItemQuantities({ ...itemQuantities, [item.id]: 0 });
                      } else if (numValue > item.currentQuantity) {
                        setReasonError(
                          `Cannot exceed available quantity (${item.currentQuantity}).`
                        );
                        setItemQuantities({
                          ...itemQuantities,
                          [item.id]: item.currentQuantity,
                        });
                      } else {
                        setReasonError(null);
                        setItemQuantities({
                          ...itemQuantities,
                          [item.id]: numValue,
                        });
                      }
                    }}
                    min="1"
                    max={item.currentQuantity}
                    className={`col-span-2 ${reasonError ? "border-destructive" : ""}`}
                  />
                  <div className="col-span-1"></div>
                  {reasonError && (
                    <p className="col-span-3 text-xs text-destructive pl-1">
                      {reasonError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Confirm Bulk Rework"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
