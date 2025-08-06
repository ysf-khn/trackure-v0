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
import { RotateCcw, ArrowLeft, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";
import { useWorkerPermissions } from "@/components/providers/permissions-provider";
import { getPreviousStages } from "@/lib/workflow-utils";
import { useScrapItems } from "@/hooks/mutations/use-scrap-items";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

interface SingleItemReworkQuantityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: {
    id: string;
    sku?: string | null;
    currentQuantity: number;
    currentStageId: string;
  };
  workflowData?: FetchedWorkflowStage[];
  onConfirmRework: (
    itemId: string,
    quantity: number,
    reason: string,
    targetStageId: string,
    sourceStageId: string,
  ) => void;
  onConfirmScrap?: (
    itemId: string,
    quantity: number,
    reason: string,
    createReplacement: boolean
  ) => void;
  isProcessing: boolean;
  userRole?: string | null;
}

export function SingleItemReworkQuantityModal({
  isOpen,
  onOpenChange,
  item,
  workflowData,
  onConfirmRework,
  onConfirmScrap,
  isProcessing,
  userRole,
}: SingleItemReworkQuantityModalProps) {
  const [action, setAction] = useState<"rework" | "scrap_and_replace" | "scrap_totally">("rework");
  const [quantityToRework, setQuantityToRework] = useState<number>(1);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [reworkReason, setReworkReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [downloadVoucher, setDownloadVoucher] = useState<boolean>(false);

  // Get organization ID and scrap mutation
  const { organizationId } = useProfileAndOrg();
  const { mutate: scrapItems, isPending: isScrapPending } = useScrapItems();

  // Get rework target options using tree structure
  const reworkTargetOptions = React.useMemo(() => {
    console.log(`[ReworkModal] Debug info:`, {
      workflowDataLength: workflowData?.length || 0,
      currentStageId: item.currentStageId,
      workflowData: workflowData?.map(s => ({ id: s.id, name: s.name, full_path: s.full_path }))
    });

    if (!workflowData || workflowData.length === 0) {
      console.log(`[ReworkModal] No workflow data available`);
      return [];
    }

    // Use getPreviousStages to get all valid rework targets
    const previousStages = getPreviousStages(
      workflowData,
      item.currentStageId,
      null
    );

    console.log(`[ReworkModal] Previous stages found:`, previousStages);

    // Convert to the format expected by the select component
    const options = previousStages.map(stage => ({
      id: stage.id,
      name: stage.name || `Stage ${stage.id}`,
    }));

    console.log(`[ReworkModal] Final options:`, options);
    return options;
  }, [workflowData, item.currentStageId, item.currentSubStageId]);

  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens
      setAction("rework");
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
    if (action === "rework" && !selectedStageId) {
      toast.error("Please select a target stage for rework.");
      canSubmit = false;
    }

    if (!canSubmit) {
      toast.error("Please correct the errors before submitting.");
      return;
    }

    if (action === "scrap_and_replace" || action === "scrap_totally") {
      // Handle scrap action
      if (onConfirmScrap) {
        onConfirmScrap(
          item.id,
          quantityToRework,
          reworkReason.trim(),
          action === "scrap_and_replace"
        );
      } else if (organizationId) {
        // Use the new scrap mutation hook
        scrapItems(
          {
            items: [{ id: item.id, quantity: quantityToRework, stage_id: item.currentStageId }],
            scrap_reason: reworkReason.trim(),
            create_replacement: action === "scrap_and_replace",
            preserve_total_quantity: action === "scrap_and_replace", // Only preserve for replacements
            organizationId,
          },
          {
            onSuccess: () => {
              onOpenChange(false);
            },
          }
        );
      } else {
        toast.error("Organization not found. Please refresh and try again.");
      }
      return;
    }

    // Handle rework action
    const targetStageId = selectedStageId;
    const targetStageIdForVoucher = selectedStageId;

    onConfirmRework(
      item.id,
      quantityToRework,
      reworkReason.trim(),
      targetStageId,
      item.currentStageId
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
    (action === "rework" ? selectedStageId : true);

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
                {action === "rework" ? "Send Item for Rework" : 
                 action === "scrap_and_replace" ? "Scrap & Replace Item" : 
                 "Scrap Item Completely"}
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
            {action === "rework" ? 
              "Send this item back to an earlier stage for rework. Specify the quantity, target stage, and reason for rework." :
              action === "scrap_and_replace" ?
              "Scrap this item and create replacement items. Specify the quantity and reason for scrapping." :
              "Permanently scrap this item from production. Specify the quantity and reason for scrapping."
            }
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

          {/* Action Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Action</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="rework"
                  name="action"
                  value="rework"
                  checked={action === "rework"}
                  onChange={() => setAction("rework")}
                  disabled={isProcessing || isScrapPending}
                />
                <label htmlFor="rework" className="flex items-center gap-2 cursor-pointer">
                  Send Back for Rework
                  <span className="text-sm text-muted-foreground">
                    (Move to previous stage)
                  </span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scrap_and_replace"
                  name="action"
                  value="scrap_and_replace"
                  checked={action === "scrap_and_replace"}
                  onChange={() => setAction("scrap_and_replace")}
                  disabled={isProcessing || isScrapPending}
                />
                <label htmlFor="scrap_and_replace" className="flex items-center gap-2 cursor-pointer">
                  <Trash2 className="h-4 w-4 text-orange-500" />
                  Scrap & Replace
                  <span className="text-sm text-muted-foreground">
                    (Create new items to replace scrapped ones)
                  </span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scrap_totally"
                  name="action"
                  value="scrap_totally"
                  checked={action === "scrap_totally"}
                  onChange={() => setAction("scrap_totally")}
                  disabled={isProcessing || isScrapPending}
                />
                <label htmlFor="scrap_totally" className="flex items-center gap-2 cursor-pointer">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  Scrap Completely
                  <span className="text-sm text-muted-foreground">
                    (Remove from production permanently)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Target Stage Selection */}
          {action === "rework" && (
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
          )}

          {/* Quantity Input */}
          <div className="space-y-3">
            <Label htmlFor="rework-quantity" className="text-sm font-medium">
              {action === "rework" ? "Quantity to Rework" : "Quantity to Scrap"}
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

          {/* Reason */}
          <div className="space-y-3">
            <Label htmlFor="rework-reason" className="text-sm font-medium">
              {action === "rework" ? "Rework Reason" : "Scrap Reason"}
            </Label>
            <div className="space-y-2">
              <Textarea
                id="rework-reason"
                value={reworkReason}
                onChange={handleReasonChange}
                placeholder={action === "rework" ? 
                  "Describe why this item needs rework... (minimum 3 characters)" :
                  "Describe why this item is being scrapped... (minimum 3 characters)"
                }
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
              <span className="text-muted-foreground">
                {action === "rework" ? "Reworking:" : 
                 action === "scrap_and_replace" ? "Scrapping & Replacing:" :
                 "Scrapping:"}
              </span>
              <span className="ml-2 font-medium">{quantityToRework} units</span>
            </div>
            <div className="flex items-center gap-2">
              {isValid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <Badge variant={isValid ? "default" : "secondary"}>
                {isValid ? 
                  (action === "rework" ? "Ready to rework" : 
                   action === "scrap_and_replace" ? "Ready to scrap & replace" :
                   "Ready to scrap") : 
                  "Complete all fields"}
              </Badge>
            </div>
          </div>

          {/* Voucher option for Owners - only for rework */}
          {userRole === "Owner" && action === "rework" && (
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
            disabled={!isValid || isProcessing || isScrapPending}
            className="min-w-[140px]"
          >
            {isProcessing || isScrapPending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                {isScrapPending ? "Scrapping..." : "Processing..."}
              </div>
            ) : (
              action === "rework" ? 
                `Rework ${quantityToRework} ${quantityToRework === 1 ? "Item" : "Items"}` :
              action === "scrap_and_replace" ?
                `Scrap & Replace ${quantityToRework} ${quantityToRework === 1 ? "Item" : "Items"}` :
                `Scrap ${quantityToRework} ${quantityToRework === 1 ? "Item" : "Items"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
