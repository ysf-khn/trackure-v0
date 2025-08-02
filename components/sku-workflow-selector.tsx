"use client";

import * as React from "react";
import { useState } from "react";
import { Check, ChevronsUpDown, Building2, Package } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface SKUOption {
  value: string;
  label: string;
  itemCount?: number;
}

interface SKUWorkflowSelectorProps {
  skus: SKUOption[];
  selectedSKU: string | null;
  onSKUChange: (sku: string | null) => void;
  isLoading?: boolean;
  className?: string;
}

export function SKUWorkflowSelector({
  skus,
  selectedSKU,
  onSKUChange,
  isLoading = false,
  className,
}: SKUWorkflowSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedSKUObj = skus.find(sku => sku.value === selectedSKU);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wider">Workflow View</h3>
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left h-auto py-2"
            disabled={isLoading}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedSKU ? (
                <>
                  <Package className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {selectedSKUObj?.label || selectedSKU}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      SKU-specific workflow
                    </div>
                  </div>
                  {selectedSKUObj?.itemCount !== undefined && (
                    <Badge variant="secondary" className="flex-shrink-0">
                      {selectedSKUObj.itemCount}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Organization Workflow</div>
                    <div className="text-xs text-muted-foreground">
                      Default workflow
                    </div>
                  </div>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search SKUs..." />
            <CommandList>
              <CommandEmpty>No SKUs found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="organization"
                  onSelect={() => {
                    onSKUChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSKU === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Building2 className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">Organization Workflow</div>
                    <div className="text-xs text-muted-foreground">
                      Default workflow for all SKUs
                    </div>
                  </div>
                </CommandItem>
                {skus.map((sku) => (
                  <CommandItem
                    key={sku.value}
                    value={sku.value}
                    onSelect={(currentValue) => {
                      onSKUChange(currentValue === selectedSKU ? null : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSKU === sku.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Package className="mr-2 h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{sku.label}</div>
                      <div className="text-xs text-muted-foreground">
                        SKU: {sku.value}
                      </div>
                    </div>
                    {sku.itemCount !== undefined && (
                      <Badge variant="secondary" className="ml-2">
                        {sku.itemCount}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}