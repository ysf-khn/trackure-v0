"use client";

import * as React from "react";
import { useState, useEffect } from "react";
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

interface MoveItemQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: {
    id: string;
    sku?: string | null; // Display name for the item
    currentQuantity: number; // Max quantity available to move
  };
  targetStageName: string; // Display name for the target stage
  targetStageId?: string | null; // ID of the target stage
  onConfirmMove: (itemId: string, quantity: number) => void;
  userRole?: string | null;
}

export function MoveItemQuantityModal({
  isOpen,
  onOpenChange,
  item,
  targetStageName,
  targetStageId,
  onConfirmMove,
  userRole,
}: MoveItemQuantityModalProps) {
  const [quantityToMove, setQuantityToMove] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [downloadVoucher, setDownloadVoucher] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setQuantityToMove(1); // Reset to 1 when modal opens
      setError(null);
      setDownloadVoucher(false); // Reset voucher option
    }
  }, [isOpen]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setQuantityToMove(0); // Allow empty input temporarily
      setError("Quantity is required.");
      return;
    }

    const numVal = parseInt(val, 10);

    if (isNaN(numVal)) {
      setError("Please enter a valid number.");
      setQuantityToMove(0); // Or keep previous valid state / set to 0
    } else if (numVal <= 0) {
      setError("Quantity must be greater than 0.");
      setQuantityToMove(numVal);
    } else if (numVal > item.currentQuantity) {
      setError(
        `Quantity cannot exceed available quantity (${item.currentQuantity}).`
      );
      setQuantityToMove(numVal);
    } else {
      setError(null);
      setQuantityToMove(numVal);
    }
  };

  const handleSubmit = async () => {
    if (error || quantityToMove <= 0) {
      toast.error(error || "Please enter a valid quantity greater than 0.");
      return;
    }
    onConfirmMove(item.id, quantityToMove);

    // Download voucher if user is Owner AND they chose to download
    if (userRole === "Owner" && downloadVoucher) {
      try {
        const response = await fetch(`/api/vouchers/${item.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: quantityToMove,
            targetStageId: targetStageId,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to generate voucher");
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
      } catch (error) {
        console.error("Error downloading voucher:", error);
        toast.error("Failed to download movement voucher");
      }
    }

    onOpenChange(false); // Close modal on successful submission
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Move Item to {targetStageName}</DialogTitle>
          <DialogDescription>
            Specify the quantity of <strong>{item.sku || item.id}</strong>{" "}
            (Available: {item.currentQuantity}) to move.
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
              value={quantityToMove === 0 && error ? "" : quantityToMove} // Show empty if user typed invalid leading to 0
              onChange={handleQuantityChange}
              min="1"
              max={item.currentQuantity}
              className="col-span-3"
              autoFocus
            />
          </div>
          {error && (
            <p className="col-span-4 text-sm text-destructive text-center px-1">
              {error}
            </p>
          )}

          {userRole === "Owner" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="download-voucher"
                checked={downloadVoucher}
                onCheckedChange={(checked) =>
                  setDownloadVoucher(checked as boolean)
                }
              />
              <Label htmlFor="download-voucher" className="text-sm font-normal">
                Download movement voucher
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!!error || quantityToMove <= 0}
          >
            Confirm Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
