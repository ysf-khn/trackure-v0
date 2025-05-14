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
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area"; // For potentially long lists of items

export interface ItemForBulkMove {
  id: string;
  sku?: string | null;
  currentQuantity: number;
}

interface BulkMoveQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  itemsToMove: ItemForBulkMove[];
  targetStage: {
    id: string | null; // Can be null for 'immediate next' if API handles it, or resolved before calling
    name: string | null;
  };
  onConfirmBulkMove: (
    movedItems: { id: string; quantity: number }[],
    targetStageId: string | null
  ) => void;
  isMovingItems: boolean; // To disable confirm button during API call
}

export function BulkMoveQuantityModal({
  isOpen,
  onOpenChange,
  itemsToMove,
  targetStage,
  onConfirmBulkMove,
  isMovingItems,
}: BulkMoveQuantityModalProps) {
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {}
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Initialize quantities to 1 for each item when modal opens or items change
  useEffect(() => {
    if (isOpen) {
      const initialQuantities: Record<string, number> = {};
      const initialErrors: Record<string, string | null> = {};
      itemsToMove.forEach((item) => {
        initialQuantities[item.id] = 1; // Default to 1
        initialErrors[item.id] = null;
      });
      setItemQuantities(initialQuantities);
      setErrors(initialErrors);
    }
  }, [isOpen, itemsToMove]);

  const handleQuantityChange = useCallback(
    (itemId: string, currentItemQuantity: number, value: string) => {
      const newErrors = { ...errors };
      let numVal: number;

      if (value === "") {
        numVal = 0; // Allow empty input temporarily
        newErrors[itemId] = "Quantity is required.";
      } else {
        numVal = parseInt(value, 10);
        if (isNaN(numVal)) {
          newErrors[itemId] = "Invalid number.";
          numVal = itemQuantities[itemId] || 0; // Keep old value or 0 if parsing failed
        } else if (numVal <= 0) {
          newErrors[itemId] = "Quantity must be > 0.";
        } else if (numVal > currentItemQuantity) {
          newErrors[itemId] = `Max: ${currentItemQuantity}.`;
        } else {
          newErrors[itemId] = null;
        }
      }

      setItemQuantities((prev) => ({ ...prev, [itemId]: numVal }));
      setErrors(newErrors);
    },
    [errors, itemQuantities]
  );

  const handleSubmit = () => {
    const itemsToSubmit: { id: string; quantity: number }[] = [];
    let hasOverallError = false;

    for (const item of itemsToMove) {
      const quantity = itemQuantities[item.id];
      if (errors[item.id] || quantity === undefined || quantity <= 0) {
        hasOverallError = true;
        // Ensure specific error is shown if not already
        if (!errors[item.id] && (quantity === undefined || quantity <= 0)) {
          setErrors((prev) => ({
            ...prev,
            [item.id]: prev[item.id] || "Valid quantity required.",
          }));
        }
      } else {
        itemsToSubmit.push({ id: item.id, quantity });
      }
    }

    if (hasOverallError) {
      toast.error("Please correct the errors in the quantities.");
      return;
    }

    if (itemsToSubmit.length === 0) {
      toast.error("No items selected with valid quantities to move.");
      return;
    }

    onConfirmBulkMove(itemsToSubmit, targetStage.id);
    // onOpenChange(false); // Parent should close modal on success/failure if desired
  };

  if (!itemsToMove || itemsToMove.length === 0) {
    // This case should ideally be handled before opening the modal
    if (isOpen) onOpenChange(false);
    return null;
  }

  const overallValid =
    Object.values(errors).every((e) => e === null) &&
    itemsToMove.some((item) => (itemQuantities[item.id] || 0) > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Move Selected Items to {targetStage.name || "Next Stage"}
          </DialogTitle>
          <DialogDescription>
            Specify the quantity for each item you want to move.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="grid gap-4 py-4 pr-1">
            {itemsToMove.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-3 items-center gap-x-4 gap-y-1 py-2 border-b last:border-b-0"
              >
                <Label
                  htmlFor={`quantity-${item.id}`}
                  className="col-span-3 text-sm font-medium truncate"
                >
                  {item.sku || item.id} (Available: {item.currentQuantity})
                </Label>
                <Input
                  id={`quantity-${item.id}`}
                  type="number"
                  value={
                    itemQuantities[item.id] === 0 && errors[item.id]
                      ? ""
                      : itemQuantities[item.id] || ""
                  }
                  onChange={(e) =>
                    handleQuantityChange(
                      item.id,
                      item.currentQuantity,
                      e.target.value
                    )
                  }
                  min="1"
                  max={item.currentQuantity}
                  className={`col-span-2 ${errors[item.id] ? "border-destructive" : ""}`}
                />
                <div className="col-span-1">
                  {" "}
                  {/* Placeholder for potential future actions or status per item */}
                </div>

                {errors[item.id] && (
                  <p className="col-span-3 text-xs text-destructive pl-1">
                    {errors[item.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" disabled={isMovingItems}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isMovingItems || !overallValid}
          >
            {isMovingItems ? "Moving..." : "Confirm Bulk Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
