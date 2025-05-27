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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, ArrowRight, CheckCircle } from "lucide-react";

interface MoveItemQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: {
    id: string;
    sku?: string | null;
    currentQuantity: number;
  };
  targetStageName: string;
  targetStageId?: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setQuantityToMove(1);
      setError(null);
      setDownloadVoucher(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setQuantityToMove(0);
      setError("Quantity is required.");
      return;
    }

    const numVal = parseInt(val, 10);

    if (isNaN(numVal)) {
      setError("Please enter a valid number.");
      setQuantityToMove(0);
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

    setIsSubmitting(true);

    try {
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
          toast.success("Movement voucher downloaded successfully");
        } catch (error) {
          console.error("Error downloading voucher:", error);
          toast.error("Failed to download movement voucher");
        }
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error in move submission:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  const isValid = !error && quantityToMove > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">Move Item Forward</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {item.sku || item.id}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  {targetStageName}
                </Badge>
              </div>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Specify the quantity to move to{" "}
            <span className="font-medium">{targetStageName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 py-4">
          {/* Item Information Card */}
          <div className="p-4 border rounded-lg bg-muted/20">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Item Details</Label>
                <Badge variant="outline" className="text-xs">
                  Available: {item.currentQuantity}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">SKU:</span>
                  <div className="font-medium">{item.sku || item.id}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Available Quantity:
                  </span>
                  <div className="font-medium">{item.currentQuantity}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-3">
            <Label htmlFor="quantity" className="text-sm font-medium">
              Quantity to Move
            </Label>
            <div className="space-y-2">
              <Input
                id="quantity"
                type="number"
                value={quantityToMove === 0 && error ? "" : quantityToMove}
                onChange={handleQuantityChange}
                min="1"
                max={item.currentQuantity}
                className={`text-lg h-12 ${error ? "border-destructive" : ""}`}
                placeholder="Enter quantity"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full"></span>
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <span className="text-muted-foreground">Moving:</span>
              <span className="ml-2 font-medium">{quantityToMove} units</span>
            </div>
            <div className="flex items-center gap-2">
              {isValid && <CheckCircle className="h-4 w-4 text-green-600" />}
              <Badge variant={isValid ? "default" : "secondary"}>
                {isValid ? "Ready to move" : "Check quantity"}
              </Badge>
            </div>
          </div>

          {/* Voucher option for Owners */}
          {userRole === "Owner" && (
            <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Checkbox
                id="download-voucher"
                checked={downloadVoucher}
                onCheckedChange={(checked) =>
                  setDownloadVoucher(checked as boolean)
                }
              />
              <div className="flex-1">
                <Label
                  htmlFor="download-voucher"
                  className="text-sm font-medium cursor-pointer"
                >
                  Download movement voucher
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a PDF voucher for this movement
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Moving...
              </div>
            ) : (
              `Move ${quantityToMove} ${quantityToMove === 1 ? "Item" : "Items"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
