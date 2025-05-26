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
import { Textarea } from "@/components/ui/textarea"; // For rework reason
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SingleItemReworkQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: {
    id: string;
    sku?: string | null;
    currentQuantity: number; // Max quantity available
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
      setDownloadVoucher(false); // Reset voucher option
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

    onConfirmRework(
      item.id,
      quantityToRework,
      reworkReason.trim(),
      targetStageId, // Use the parent stage ID
      item.currentStageId,
      item.currentSubStageId
    );

    console.log("USER ROLE==", userRole);

    // Download voucher if user is Owner AND they chose to download
    console.log(
      `[VoucherDebug] handleSubmit: Checking userRole. Value: '${userRole}' (Type: ${typeof userRole})`
    );
    console.log(
      `[VoucherDebug] handleSubmit: userRole === "Owner": ${userRole === "Owner"}`
    );
    console.log(
      `[VoucherDebug] handleSubmit: downloadVoucher: ${downloadVoucher}`
    );

    if (userRole === "Owner" && downloadVoucher) {
      console.log(
        "[VoucherDebug] handleSubmit: Voucher download condition met."
      );
      console.log("REWORKKKK");
      try {
        console.log(
          `[VoucherDebug] handleSubmit: About to fetch voucher for item ${item.id} with quantity ${quantityToRework}`
        );
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
        console.log(
          `[VoucherDebug] handleSubmit: Fetch response - Status: ${response.status}, OK: ${response.ok}`
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[VoucherDebug] handleSubmit: Response not OK. Status: ${response.status}, Body: ${errorText}`
          );
          throw new Error("Failed to generate voucher");
        }
        const blob = await response.blob();
        console.log(
          `[VoucherDebug] handleSubmit: Blob created, size: ${blob.size} bytes`
        );
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rework_voucher_${item.sku || item.id}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
        document.body.appendChild(a);
        a.click();
        console.log(
          `[VoucherDebug] handleSubmit: Download triggered for ${a.download}`
        );
        window.URL.revokeObjectURL(url);
        a.remove();
      } catch (error) {
        console.error("Error downloading voucher:", error);
        toast.error("Failed to download rework voucher");
      }
    } else {
      console.log(
        `[VoucherDebug] handleSubmit: Voucher download condition NOT met. User role: '${userRole}' (Type: ${typeof userRole}) - was not "Owner" or downloadVoucher was ${downloadVoucher}.`
      );
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Item for Rework</DialogTitle>
          <DialogDescription>
            Specify quantity and reason for reworking item{" "}
            <strong>{item.sku || item.id}</strong> (Available:{" "}
            {item.currentQuantity}).
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
                {reworkTargetOptions.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name || stage.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rework-quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="rework-quantity"
              type="number"
              value={
                quantityToRework === 0 && quantityError ? "" : quantityToRework
              }
              onChange={handleQuantityChange}
              min="1"
              max={item.currentQuantity}
              className={`col-span-3 ${quantityError ? "border-destructive" : ""}`}
              autoFocus
            />
          </div>
          {quantityError && (
            <p className="col-start-2 col-span-3 text-sm text-destructive pl-1">
              {quantityError}
            </p>
          )}

          <div className="grid grid-cols-4 items-start gap-4 mt-2">
            <Label htmlFor="rework-reason" className="text-right pt-2">
              Reason
            </Label>
            <Textarea
              id="rework-reason"
              value={reworkReason}
              onChange={handleReasonChange}
              placeholder="Describe why this item needs rework..."
              className={`col-span-3 min-h-[80px] ${reasonError ? "border-destructive" : ""}`}
            />
          </div>
          {reasonError && (
            <p className="col-start-2 col-span-3 text-sm text-destructive pl-1">
              {reasonError}
            </p>
          )}

          {userRole === "Owner" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="download-rework-voucher"
                checked={downloadVoucher}
                onCheckedChange={(checked) =>
                  setDownloadVoucher(checked as boolean)
                }
              />
              <Label
                htmlFor="download-rework-voucher"
                className="text-sm font-normal"
              >
                Download rework voucher
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={
              isProcessing ||
              !!quantityError ||
              !!reasonError ||
              quantityToRework <= 0 ||
              reworkReason.trim().length < 3 ||
              !selectedStageId
            }
          >
            {isProcessing ? "Processing..." : "Confirm Rework"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
