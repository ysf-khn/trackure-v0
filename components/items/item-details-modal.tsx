"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ItemDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  details: Record<string, unknown> | null;
  itemName?: string | null; // Optional: for a more descriptive title
}

// Helper function to format attribute keys
const formatAttributeKey = (key: string): string => {
  // Handle snake_case to "Title Case"
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function ItemDetailsModal({
  isOpen,
  onOpenChange,
  details,
  itemName,
}: ItemDetailsModalProps) {
  if (!details) return null;

  const detailEntries = Object.entries(details);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Details for {itemName || "Item"}</DialogTitle>
          <DialogDescription>
            Specific attributes and values for this item instance.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {" "}
          {/* Add scroll for long details */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Attribute</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailEntries.length > 0 ? (
                detailEntries.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      {formatAttributeKey(key)}
                    </TableCell>
                    <TableCell>{String(value)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-muted-foreground"
                  >
                    No details available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
