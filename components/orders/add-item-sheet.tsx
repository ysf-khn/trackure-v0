"use client";

import React, { useState } from "react";
import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AddItemForm } from "@/components/items/add-item-form";

interface AddItemSheetProps {
  orderId: string;
  canAddItem: boolean;
}

export function AddItemSheet({ orderId, canAddItem }: AddItemSheetProps) {
  const [open, setOpen] = useState(false);

  if (!canAddItem) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full sm:w-auto" size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add New Item
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle>Add New Item</SheetTitle>
              <SheetDescription>
                Create a new item for this order. Fill in the required information below.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="mt-6">
          <AddItemForm 
            orderId={orderId} 
            onItemAdded={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}