"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Download, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";

interface PdfDownloadModalProps {
  itemId: string | null;
  itemSku: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  totalHistoryCount?: number;
}

export function PdfDownloadModal({
  itemId,
  itemSku,
  isOpen,
  onOpenChange,
  totalHistoryCount = 0,
}: PdfDownloadModalProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [maxRecords, setMaxRecords] = useState<string>("no-limit");
  const [customLimit, setCustomLimit] = useState<string>("");
  const [includeRemarks, setIncludeRemarks] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!itemId) {
      toast.error("No item selected");
      return;
    }

    setIsGenerating(true);

    try {
      // Build query parameters
      const params = new URLSearchParams();

      // Only add date parameters if they have valid values
      if (dateRange?.from) {
        params.append("dateFrom", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append("dateTo", dateRange.to.toISOString());
      }

      // Handle max records logic
      if (maxRecords === "custom" && customLimit && parseInt(customLimit) > 0) {
        params.append("maxRecords", customLimit);
      } else if (maxRecords !== "no-limit" && parseInt(maxRecords) > 0) {
        params.append("maxRecords", maxRecords);
      }

      if (includeRemarks) {
        params.append("includeRemarks", "true");
      }

      console.log("Sending parameters:", Object.fromEntries(params.entries()));

      // Make API call to generate PDF
      const response = await fetch(
        `/api/items/${itemId}/history-pdf?${params.toString()}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Extract filename from response headers or create default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `item_history_${itemSku || itemId}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("PDF downloaded successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download PDF"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setDateRange(undefined);
    setMaxRecords("no-limit");
    setCustomLimit("");
    setIncludeRemarks(true);
  };

  // Calculate estimated records based on filters
  const getEstimatedRecords = () => {
    if (maxRecords === "custom" && customLimit && parseInt(customLimit) > 0) {
      return Math.min(parseInt(customLimit), totalHistoryCount);
    } else if (maxRecords !== "no-limit" && parseInt(maxRecords) > 0) {
      return Math.min(parseInt(maxRecords), totalHistoryCount);
    }
    return totalHistoryCount;
  };

  const estimatedRecords = getEstimatedRecords();
  const showWarning = estimatedRecords > 1000;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Download History PDF
          </DialogTitle>
          <DialogDescription>
            Configure options for downloading the history report for item:{" "}
            <strong>{itemSku || itemId}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range Filters */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Date Range (Optional)</Label>
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
              className="w-full"
            />
          </div>

          {/* Record Limit */}
          <div className="space-y-2">
            <Label htmlFor="max-records" className="text-sm font-medium">
              Maximum Records (Optional)
            </Label>
            <Select value={maxRecords} onValueChange={setMaxRecords}>
              <SelectTrigger>
                <SelectValue placeholder="No limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-limit">No limit</SelectItem>
                <SelectItem value="50">50 records</SelectItem>
                <SelectItem value="100">100 records</SelectItem>
                <SelectItem value="250">250 records</SelectItem>
                <SelectItem value="500">500 records</SelectItem>
                <SelectItem value="1000">1000 records</SelectItem>
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>

            {maxRecords === "custom" && (
              <Input
                type="number"
                placeholder="Enter custom limit"
                min="1"
                max="10000"
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
              />
            )}
          </div>

          {/* Include Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include in PDF</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-remarks"
                checked={includeRemarks}
                onCheckedChange={(checked) =>
                  setIncludeRemarks(checked as boolean)
                }
              />
              <Label
                htmlFor="include-remarks"
                className="text-sm font-normal cursor-pointer"
              >
                Include remarks and comments
              </Label>
            </div>
          </div>

          {/* Estimated Records Info */}
          <div className="rounded-lg bg-muted p-3">
            <div className="text-sm">
              <div className="font-medium">Estimated Records</div>
              <div className="text-muted-foreground">
                Movement History: ~{estimatedRecords} records
                {includeRemarks && " + Remarks"}
              </div>
            </div>
          </div>

          {/* Warning for large datasets */}
          {showWarning && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Large dataset detected ({estimatedRecords} records). Consider
                applying date filters or record limits to reduce PDF size and
                generation time.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isGenerating}
          >
            Reset Filters
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
