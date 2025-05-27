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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowRight } from "lucide-react";

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
    id: string | null;
    name: string | null;
  };
  onConfirmBulkMove: (
    movedItems: { id: string; quantity: number }[],
    targetStageId: string | null
  ) => void;
  isMovingItems: boolean;
  userRole?: string | null;
}

export function BulkMoveQuantityModal({
  isOpen,
  onOpenChange,
  itemsToMove,
  targetStage,
  onConfirmBulkMove,
  isMovingItems,
  userRole,
}: BulkMoveQuantityModalProps) {
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {}
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [downloadVouchers, setDownloadVouchers] = useState<boolean>(false);

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
      setDownloadVouchers(false); // Reset voucher option
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

  const handleSubmit = async () => {
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

    // Download vouchers if user is Owner AND they chose to download
    if (userRole === "Owner" && downloadVouchers) {
      try {
        // Download vouchers for each item
        for (const item of itemsToMove) {
          const quantity = itemQuantities[item.id];
          if (quantity && quantity > 0) {
            const response = await fetch(`/api/vouchers/${item.id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                quantity: quantity,
                targetStageId: targetStage.id,
              }),
            });

            if (!response.ok) {
              console.error(`Failed to generate voucher for item ${item.id}`);
              toast.error(
                `Failed to generate voucher for ${item.sku || item.id}`
              );
              continue;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `movement_voucher_${item.sku || item.id}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            // Add a small delay between downloads to prevent browser issues
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        toast.success("Movement vouchers downloaded successfully");
      } catch (error) {
        console.error("Error downloading vouchers:", error);
        toast.error("Failed to download movement vouchers");
      }
    }
  };

  if (!itemsToMove || itemsToMove.length === 0) {
    // This case should ideally be handled before opening the modal
    if (isOpen) onOpenChange(false);
    return null;
  }

  const overallValid =
    Object.values(errors).every((e) => e === null) &&
    itemsToMove.some((item) => (itemQuantities[item.id] || 0) > 0);

  const totalItemsToMove = itemsToMove.length;
  const totalQuantityToMove = Object.values(itemQuantities).reduce(
    (sum, qty) => sum + (qty || 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">Bulk Move Items</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {totalItemsToMove} items
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  {targetStage.name || "Next Stage"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Specify the quantity for each item you want to move to{" "}
            <span className="font-medium">
              {targetStage.name || "the next stage"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[50vh] pr-4">
            <div className="space-y-4 py-4">
              {itemsToMove.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{index + 1}
                        </Badge>
                        <Label
                          htmlFor={`quantity-${item.id}`}
                          className="text-sm font-medium truncate"
                        >
                          {item.sku || item.id}
                        </Label>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        Available quantity:{" "}
                        <span className="font-medium">
                          {item.currentQuantity}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Label
                          htmlFor={`quantity-${item.id}`}
                          className="text-xs font-medium min-w-0"
                        >
                          Move quantity:
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
                          className={`w-24 h-8 text-sm ${errors[item.id] ? "border-destructive" : ""}`}
                          placeholder="1"
                        />
                      </div>

                      {errors[item.id] && (
                        <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                          <span className="w-1 h-1 bg-destructive rounded-full"></span>
                          {errors[item.id]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-4 pt-4 border-t">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <span className="text-muted-foreground">
                Total quantity to move:
              </span>
              <span className="ml-2 font-medium">{totalQuantityToMove}</span>
            </div>
            <Badge variant={overallValid ? "default" : "secondary"}>
              {overallValid ? "Ready to move" : "Check quantities"}
            </Badge>
          </div>

          {/* Voucher option for Owners */}
          {userRole === "Owner" && (
            <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Checkbox
                id="download-bulk-vouchers"
                checked={downloadVouchers}
                onCheckedChange={(checked) =>
                  setDownloadVouchers(checked as boolean)
                }
              />
              <div className="flex-1">
                <Label
                  htmlFor="download-bulk-vouchers"
                  className="text-sm font-medium cursor-pointer"
                >
                  Download movement vouchers
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate PDF vouchers for all moved items
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline" disabled={isMovingItems}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isMovingItems || !overallValid}
            className="min-w-[140px]"
          >
            {isMovingItems ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Moving...
              </div>
            ) : (
              `Move ${totalQuantityToMove} Items`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
