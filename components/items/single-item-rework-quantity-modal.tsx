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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

interface SingleItemReworkQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: {
    id: string;
    sku?: string | null;
    currentQuantity: number;
    currentStageId: string;
    currentSubStageId: string | null;
  };
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
  onConfirmRework: (
    itemId: string,
    quantity: number,
    reason: string,
    targetStageId: string,
    targetSubStageId: string | null,
    sourceStageId: string,
    sourceSubStageId: string | null
  ) => void;
  isProcessing: boolean;
  userRole?: string | null;
}

export function SingleItemReworkQuantityModal({
  isOpen,
  onOpenChange,
  item,
  availableStages,
  onConfirmRework,
  isProcessing,
  userRole,
}: SingleItemReworkQuantityModalProps) {
  const [quantityToRework, setQuantityToRework] = useState<number>(1);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [reworkReason, setReworkReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [downloadVoucher, setDownloadVoucher] = useState<boolean>(false);

  // Get the current stage's sequence order
  const currentStageSequence = React.useMemo(() => {
    const currentStage = availableStages.find(
      (s) => s.id === item.currentStageId
    );
    return currentStage?.sequence_order ?? Infinity;
  }, [availableStages, item.currentStageId]);

  // Filter available stages to only show stages before the current stage
  const reworkTargetOptions = React.useMemo(() => {
    const options: { id: string; name: string | null }[] = [];

    availableStages
      .filter((stage) => stage.sequence_order < currentStageSequence)
      .forEach((stage) => {
        if (stage.sub_stages && stage.sub_stages.length > 0) {
          // If stage has substages, add all substages
          stage.sub_stages.forEach((subStage) => {
            options.push({
              id: subStage.id,
              name: `${stage.name} > ${subStage.name || "Unnamed Substage"}`,
            });
          });
        } else {
          // If no substages, add the stage itself
          options.push({
            id: stage.id,
            name: stage.name,
          });
        }
      });

    return options;
  }, [availableStages, currentStageSequence]);

  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens
      setQuantityToRework(1);
      setQuantityError(null);
      setReworkReason("");
      setReasonError(null);
      setSelectedStageId(reworkTargetOptions[0]?.id || "");
      setDownloadVoucher(false);
    }
  }, [isOpen, reworkTargetOptions]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setQuantityToRework(value);

    if (isNaN(value) || value <= 0) {
      setQuantityError("Quantity must be a positive number.");
    } else if (value > item.currentQuantity) {
      setQuantityError(
        `Cannot exceed available quantity (${item.currentQuantity}).`
      );
    } else {
      setQuantityError(null);
    }
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setReworkReason(value);

    if (value.trim().length < 3) {
      setReasonError("Reason must be at least 3 characters long.");
    } else {
      setReasonError(null);
    }
  };

  const handleSubmit = async () => {
    let canSubmit = true;
    if (quantityToRework <= 0 || quantityError) {
      if (!quantityError) setQuantityError("Valid quantity required.");
      canSubmit = false;
    }
    if (reworkReason.trim().length < 3 || reasonError) {
      if (!reasonError) setReasonError("Valid reason required.");
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

    // Find the selected stage/substage in the available stages
    let targetStageId = selectedStageId;
    let targetStageIdForVoucher = selectedStageId;
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

    onConfirmRework(
      item.id,
      quantityToRework,
      reworkReason.trim(),
      targetStageId,
      isSubStage ? selectedStageId : null,
      item.currentStageId,
      item.currentSubStageId
    );

    // Download voucher if user is Owner AND they chose to download
    if (userRole === "Owner" && downloadVoucher) {
      try {
        const response = await fetch(`/api/vouchers/${item.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: quantityToRework,
            targetStageId: targetStageIdForVoucher,
            isRework: true,
            reworkReason: reworkReason.trim(),
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Response not OK. Status: ${response.status}, Body: ${errorText}`
          );
          throw new Error("Failed to generate voucher");
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
        toast.success("Rework voucher downloaded successfully");
      } catch (error) {
        console.error("Error downloading voucher:", error);
        toast.error("Failed to download rework voucher");
      }
    }
  };

  if (!item) return null;

  const selectedTargetStage = reworkTargetOptions.find(
    (stage) => stage.id === selectedStageId
  );

  const isValid =
    !quantityError &&
    !reasonError &&
    quantityToRework > 0 &&
    reworkReason.trim().length >= 3 &&
    selectedStageId;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/20 rounded-lg">
              <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">
                Send Item for Rework
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {item.sku || item.id}
                </Badge>
                <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  {selectedTargetStage?.name || "Select target stage"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Send this item back to an earlier stage for rework. Specify the
            quantity, target stage, and reason for rework.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 py-4 overflow-y-auto">
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

          {/* Target Stage Selection */}
          <div className="space-y-3">
            <Label htmlFor="target-stage" className="text-sm font-medium">
              Target Stage for Rework
            </Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select target stage" />
              </SelectTrigger>
              <SelectContent>
                {reworkTargetOptions.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name || stage.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input */}
          <div className="space-y-3">
            <Label htmlFor="rework-quantity" className="text-sm font-medium">
              Quantity to Rework
            </Label>
            <div className="space-y-2">
              <Input
                id="rework-quantity"
                type="number"
                value={
                  quantityToRework === 0 && quantityError
                    ? ""
                    : quantityToRework
                }
                onChange={handleQuantityChange}
                min="1"
                max={item.currentQuantity}
                className={`text-lg h-12 ${quantityError ? "border-destructive" : ""}`}
                placeholder="Enter quantity"
              />
              {quantityError && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full"></span>
                  {quantityError}
                </p>
              )}
            </div>
          </div>

          {/* Rework Reason */}
          <div className="space-y-3">
            <Label htmlFor="rework-reason" className="text-sm font-medium">
              Rework Reason
            </Label>
            <div className="space-y-2">
              <Textarea
                id="rework-reason"
                value={reworkReason}
                onChange={handleReasonChange}
                placeholder="Describe why this item needs rework... (minimum 3 characters)"
                className={`min-h-[100px] resize-none ${reasonError ? "border-destructive" : ""}`}
              />
              {reasonError && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full"></span>
                  {reasonError}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {reworkReason.length}/3 characters minimum
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <span className="text-muted-foreground">Reworking:</span>
              <span className="ml-2 font-medium">{quantityToRework} units</span>
            </div>
            <div className="flex items-center gap-2">
              {isValid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <Badge variant={isValid ? "default" : "secondary"}>
                {isValid ? "Ready to rework" : "Complete all fields"}
              </Badge>
            </div>
          </div>

          {/* Voucher option for Owners */}
          {userRole === "Owner" && (
            <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Checkbox
                id="download-rework-voucher"
                checked={downloadVoucher}
                onCheckedChange={(checked) =>
                  setDownloadVoucher(checked as boolean)
                }
              />
              <div className="flex-1">
                <Label
                  htmlFor="download-rework-voucher"
                  className="text-sm font-medium cursor-pointer"
                >
                  Download rework voucher
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a PDF voucher for this rework operation
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isProcessing}
            className="min-w-[140px]"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </div>
            ) : (
              `Rework ${quantityToRework} ${quantityToRework === 1 ? "Item" : "Items"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
