"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAvailableComponentSkus } from "@/hooks/queries/use-composite-items";

import type {
  CreateCompositeItemRequest,
  UpdateCompositeItemRequest,
  CompositeItemDefinitionWithComponents,
} from "@/types/composite-items";
import { cn } from "@/lib/utils";

interface ComponentFormData {
  component_sku: string;
  quantity_per_composite: number;
}

interface CompositeItemDefinitionFormProps {
  organizationId: string;
  initialData?: CompositeItemDefinitionWithComponents;
  onSubmit: (
    data: CreateCompositeItemRequest | UpdateCompositeItemRequest
  ) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function CompositeItemDefinitionForm({
  organizationId,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: CompositeItemDefinitionFormProps) {
  const { data: availableSkus = [], isLoading: isLoadingSkus } =
    useAvailableComponentSkus(organizationId);

  // Form state
  const [compositeSku, setCompositeSku] = useState(
    initialData?.composite_sku || ""
  );
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [components, setComponents] = useState<ComponentFormData[]>(
    initialData?.components.map((c) => ({
      component_sku: c.component_sku,
      quantity_per_composite: c.quantity_per_composite,
    })) || [{ component_sku: "", quantity_per_composite: 1 }]
  );
  const [componentPopoverOpen, setComponentPopoverOpen] = useState<
    Record<number, boolean>
  >({});
  const [componentSearchTerms, setComponentSearchTerms] = useState<
    Record<number, string>
  >({});

  const handleAddComponent = () => {
    setComponents([
      ...components,
      { component_sku: "", quantity_per_composite: 1 },
    ]);
  };

  const handleRemoveComponent = (index: number) => {
    if (components.length > 1) {
      setComponents(components.filter((_, i) => i !== index));
    } else {
      toast.error("At least one component is required.");
    }
  };

  const handleComponentChange = (
    index: number,
    field: keyof ComponentFormData,
    value: string | number
  ) => {
    const updatedComponents = [...components];
    updatedComponents[index] = { ...updatedComponents[index], [field]: value };
    setComponents(updatedComponents);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!compositeSku.trim()) {
      toast.error("Composite SKU is required.");
      return;
    }

    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }

    const validComponents = components.filter(
      (c) => c.component_sku && c.quantity_per_composite > 0
    );
    if (validComponents.length === 0) {
      toast.error("At least one valid component is required.");
      return;
    }

    // Check for duplicate component SKUs
    const skuCounts = validComponents.reduce(
      (acc, c) => {
        acc[c.component_sku] = (acc[c.component_sku] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const duplicateSkus = Object.keys(skuCounts).filter(
      (sku) => skuCounts[sku] > 1
    );
    if (duplicateSkus.length > 0) {
      toast.error(`Duplicate component SKUs: ${duplicateSkus.join(", ")}`);
      return;
    }

    try {
      if (mode === "create") {
        await onSubmit({
          composite_sku: compositeSku.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          components: validComponents,
        });
      } else {
        await onSubmit({
          name: name.trim(),
          description: description.trim() || undefined,
          is_active: isActive,
          components: validComponents,
        });
      }
    } catch (error) {
      // Error handling is done by parent component
      console.error("Form submission error:", error);
    }
  };

  const usedSkus = new Set(
    components.map((c) => c.component_sku).filter(Boolean)
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Create Composite Item" : "Edit Composite Item"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="composite-sku">Composite SKU *</Label>
              <Input
                id="composite-sku"
                value={compositeSku}
                onChange={(e) => setCompositeSku(e.target.value)}
                placeholder="e.g., PHONE-CASE-SET"
                disabled={mode === "edit" || isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Complete Phone Case Set"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the composite item"
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {mode === "edit" && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                className="rounded"
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          )}

          {/* Components Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Components *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddComponent}
                disabled={isSubmitting || isLoadingSkus}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Component
              </Button>
            </div>

            <div className="space-y-3">
              {components.map((component, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Component SKU *</Label>
                      <Popover
                        open={componentPopoverOpen[index] || false}
                        onOpenChange={(open) =>
                          setComponentPopoverOpen((prev) => ({
                            ...prev,
                            [index]: open,
                          }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={componentPopoverOpen[index] || false}
                            className={cn(
                              "w-full justify-between",
                              !component.component_sku &&
                                "text-muted-foreground"
                            )}
                          >
                            {component.component_sku ||
                              "Type or select component SKU..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Type component SKU..."
                              value={
                                componentSearchTerms[index] ||
                                component.component_sku ||
                                ""
                              }
                              onValueChange={(value) => {
                                setComponentSearchTerms((prev) => ({
                                  ...prev,
                                  [index]: value,
                                }));
                                handleComponentChange(
                                  index,
                                  "component_sku",
                                  value
                                );
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="text-sm text-muted-foreground p-2">
                                  {componentSearchTerms[index] ||
                                  component.component_sku
                                    ? `Use "${componentSearchTerms[index] || component.component_sku}" as new SKU`
                                    : "Type to search or enter new SKU"}
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {availableSkus
                                  .filter((sku) => {
                                    const searchTerm =
                                      componentSearchTerms[index] ||
                                      component.component_sku ||
                                      "";
                                    return (
                                      (!usedSkus.has(sku.sku) ||
                                        sku.sku === component.component_sku) &&
                                      (sku.sku
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase()) ||
                                        sku.item_name
                                          ?.toLowerCase()
                                          .includes(searchTerm.toLowerCase()))
                                    );
                                  })
                                  .map((sku) => (
                                    <CommandItem
                                      key={sku.sku}
                                      value={sku.sku}
                                      onSelect={(value) => {
                                        handleComponentChange(
                                          index,
                                          "component_sku",
                                          value
                                        );
                                        setComponentSearchTerms((prev) => ({
                                          ...prev,
                                          [index]: "",
                                        }));
                                        setComponentPopoverOpen((prev) => ({
                                          ...prev,
                                          [index]: false,
                                        }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          component.component_sku === sku.sku
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {sku.sku} - {sku.item_name}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity per Composite *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={component.quantity_per_composite}
                        onChange={(e) =>
                          handleComponentChange(
                            index,
                            "quantity_per_composite",
                            parseInt(e.target.value) || 1
                          )
                        }
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveComponent(index)}
                        disabled={components.length === 1 || isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-2" />
              {mode === "create" ? "Create" : "Update"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
