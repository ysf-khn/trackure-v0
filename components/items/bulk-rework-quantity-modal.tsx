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
    targetStageId: string
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
  const [itemQuantities, setItemQuantities] = useState<
    {
      id: string;
      quantity: number;
      maxQuantity: number;
    }[]
  >(() =>
    itemsToRework.map((item) => ({
      id: item.id,
      quantity: 1,
      maxQuantity: item.currentQuantity,
    }))
  );
  const [reworkReason, setReworkReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens
      setItemQuantities(
        itemsToRework.map((item) => ({
          id: item.id,
          quantity: 1,
          maxQuantity: item.currentQuantity,
        }))
      );
      setReworkReason("");
      setReasonError(null);
      setSelectedStageId(availableStages[0]?.id || "");
    }
  }, [isOpen, itemsToRework, availableStages]);

  const handleSubmit = async () => {
    let canSubmit = true;
    const itemsWithErrors = itemQuantities.filter(
      (item) => item.quantity <= 0 || item.quantity > item.maxQuantity
    );

    if (itemsWithErrors.length > 0) {
      toast.error("Some items have invalid quantities.");
      canSubmit = false;
    }

    if (reworkReason.trim().length < 3) {
      setReasonError("Valid reason required.");
      canSubmit = false;
    }

    if (!selectedStageId) {
      toast.error("Please select a target stage for rework.");
      canSubmit = false;
    }

    if (!canSubmit) {
      toast.error("Please correct the errors before submitting.");
      return;
    }

    const reworkedItems = itemQuantities.map((item) => ({
      id: item.id,
      quantity: item.quantity,
    }));

    onConfirmBulkRework(reworkedItems, reworkReason.trim(), selectedStageId);

    // Download vouchers if user is Owner
    if (userRole === "Owner") {
      try {
        // Download vouchers for each item
        for (const item of itemsToRework) {
          const response = await fetch(`/api/vouchers/${item.id}`);
          if (!response.ok) {
            throw new Error(`Failed to generate voucher for item ${item.id}`);
          }
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `rework_voucher_${item.sku || item.id}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          // Add a small delay between downloads to prevent browser issues
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error("Error downloading vouchers:", error);
        toast.error("Failed to download one or more rework vouchers");
      }
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
                      itemQuantities.find((i) => i.id === item.id)?.quantity ===
                        0 && reasonError
                        ? ""
                        : itemQuantities.find((i) => i.id === item.id)
                            ?.quantity || ""
                    }
                    onChange={(e) => {
                      const numValue = parseInt(e.target.value);
                      if (isNaN(numValue) || numValue <= 0) {
                        setReasonError("Quantity must be a positive number.");
                        setItemQuantities(
                          itemQuantities.map((i) =>
                            i.id === item.id ? { ...i, quantity: 0 } : i
                          )
                        );
                      } else if (numValue > item.currentQuantity) {
                        setReasonError(
                          `Cannot exceed available quantity (${item.currentQuantity}).`
                        );
                        setItemQuantities(
                          itemQuantities.map((i) =>
                            i.id === item.id
                              ? { ...i, quantity: item.currentQuantity }
                              : i
                          )
                        );
                      } else {
                        setReasonError(null);
                        setItemQuantities(
                          itemQuantities.map((i) =>
                            i.id === item.id ? { ...i, quantity: numValue } : i
                          )
                        );
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
