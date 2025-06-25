"use client";

import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useDebounce } from "@/hooks/queries/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Layers, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// Helper function to parse dimension strings (e.g., "LxWxH") and calculate volume
const calculateVolume = (sizeString: string | undefined): number | null => {
  if (!sizeString) return null;
  const dimensions = sizeString
    .split("x")
    .map((dim) => parseFloat(dim.trim()))
    .filter((dim) => !isNaN(dim));
  if (dimensions.length >= 3) {
    return dimensions[0] * dimensions[1] * dimensions[2];
  }
  return null;
};

// Zod schema for form validation
const formSchema = z.object({
  sku: z.string().min(1, { message: "SKU is required." }),
  isComposite: z.boolean(),
  components: z
    .array(
      z.object({
        component_sku: z.string().min(1, "Component SKU is required"),
        quantity_per_composite: z
          .number()
          .min(1, "Quantity must be at least 1"),
        // Component-specific instance details
        weight: z.string().optional(),
        size: z.string().optional(),
        net_weight: z.string().optional(),
        gross_weight: z.string().optional(),
      })
    )
    .optional(),
  // Define fields for instance_details - make them optional for manual override
  // Using string for input, backend will handle parsing/validation if necessary
  weight: z.string().optional(),
  size: z.string().optional(),
  boxSize: z.string().optional(), // e.g., "10x10x5"
  cartonSize: z.string().optional(), // e.g., "40x30x20"
  piecesPerCarton: z.number().optional().nullable(), // Calculated, make it nullable
  netWeight: z.string().optional(),
  grossWeight: z.string().optional(),
  volume: z.string().optional(), // e.g., "12x8x4" (perhaps redundant if sizes are captured)
  buyerId: z.string().optional(), // New field for buyer ID
  totalQuantity: z.string().optional(), // New field for total quantity (input as string)
  // Add other instance details fields as needed based on PRD/Schema
});

// Define a more specific type for the instance details payload
type InstanceDetailsPayload = {
  [key: string]: string | number | null | undefined;
  weight?: number | null;
  size?: string;
  box_size?: string;
  carton_size?: string;
  pieces_per_carton?: number | null;
  net_weight?: number | null;
  gross_weight?: number | null;
  volume?: string;
  buyer_id?: string; // Corresponds to buyerId in form
  total_quantity?: number | null; // Corresponds to totalQuantity in form
};

type AddItemFormProps = {
  orderId: string;
  onItemAdded?: () => void; // Optional callback after successful add
};

type SkuSuggestion = {
  value: string; // Typically the SKU itself
  label: string; // User-friendly display (e.g., SKU - Name)
  master_details?: Record<string, unknown>; // Details to pre-fill (JSONB)
  is_composite?: boolean; // Whether this is a composite item
};

type AddItemApiResponse = {
  message: string;
  itemId?: string; // For regular items
  composite_group_id?: string; // For composite items
  type: "single" | "composite";
};

type FormData = z.infer<typeof formSchema>;

export function AddItemForm({ orderId, onItemAdded }: AddItemFormProps) {
  const queryClient = useQueryClient();

  // 1. Form Setup
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      isComposite: false,
      components: [],
      weight: "",
      size: "",
      boxSize: "",
      cartonSize: "",
      piecesPerCarton: null,
      netWeight: "",
      grossWeight: "",
      volume: "",
      buyerId: "",
      totalQuantity: "",
    },
  });

  // Field array for managing components
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "components",
  });

  // Watch the isComposite field to show/hide component section
  const isComposite = form.watch("isComposite");

  // State for showing component input after clicking "Add Sub-Items"
  const [showComponentInput, setShowComponentInput] = React.useState(false);

  // Watch for changes in box size and carton size to auto-calculate pieces per carton
  const watchedBoxSize = form.watch("boxSize");
  const watchedCartonSize = form.watch("cartonSize");
  const watchedTotalQuantity = form.watch("totalQuantity");

  React.useEffect(() => {
    if (watchedBoxSize && watchedCartonSize) {
      const boxVolume = calculateVolume(watchedBoxSize);
      const cartonVolume = calculateVolume(watchedCartonSize);

      if (boxVolume && cartonVolume && boxVolume > 0) {
        const calculatedPieces = Math.floor(cartonVolume / boxVolume);
        if (calculatedPieces > 0) {
          form.setValue("piecesPerCarton", calculatedPieces);
        }
      }
    }
  }, [watchedBoxSize, watchedCartonSize, form]);

  // Note: Do NOT automatically update component quantities when total quantity changes
  // The quantity_per_composite should remain as defined in the composite definition
  // The total quantity will be used to multiply the quantity_per_composite for each component

  // 2. SKU Autocomplete State & Query
  const [skuSearch, setSkuSearch] = React.useState("");
  const debouncedSkuSearch = useDebounce(skuSearch, 300);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [selectedCompositeInfo, setSelectedCompositeInfo] = React.useState<{
    sku: string;
    name: string;
    components: Array<{
      component_sku: string;
      quantity_per_composite: number;
    }>;
  } | null>(null);

  const skuQueryResult = useQuery({
    queryKey: ["skuSuggestions", debouncedSkuSearch],
    queryFn: async (): Promise<SkuSuggestion[]> => {
      if (!debouncedSkuSearch) return [];

      const response = await fetch(
        `/api/item-master/search?q=${encodeURIComponent(debouncedSkuSearch)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch SKU suggestions");
      }
      const data = await response.json();
      return data.suggestions || [];
    },
    enabled: !!debouncedSkuSearch,
    staleTime: 30000,
  });

  const {
    data: skuSuggestions,
    isLoading: isLoadingSuggestions,
    error: skuError,
  } = skuQueryResult;

  // 3. Mutation Setup (for submitting the form)
  const mutation = useMutation<AddItemApiResponse, Error, FormData>({
    mutationFn: async (values: FormData) => {
      // Construct instance_details ensuring no undefined values are sent if empty
      const instance_details_payload: InstanceDetailsPayload = {};

      // Existing fields
      if (values.weight) {
        const parsedWeight = parseFloat(values.weight);
        if (!isNaN(parsedWeight))
          instance_details_payload.weight = parsedWeight;
      }
      if (values.size) instance_details_payload.size = values.size;
      if (values.boxSize) instance_details_payload.box_size = values.boxSize;

      // New fields
      if (values.cartonSize)
        instance_details_payload.carton_size = values.cartonSize;
      if (values.piecesPerCarton !== null)
        instance_details_payload.pieces_per_carton = values.piecesPerCarton;
      if (values.netWeight) {
        const parsedNetWeight = parseFloat(values.netWeight);
        if (!isNaN(parsedNetWeight))
          instance_details_payload.net_weight = parsedNetWeight;
      }
      if (values.grossWeight) {
        const parsedGrossWeight = parseFloat(values.grossWeight);
        if (!isNaN(parsedGrossWeight))
          instance_details_payload.gross_weight = parsedGrossWeight;
      }
      if (values.volume) instance_details_payload.volume = values.volume;

      // Add buyerId and totalQuantity to payload
      if (values.buyerId) {
        instance_details_payload.buyer_id = values.buyerId;
      }
      if (values.totalQuantity) {
        const parsedTotalQuantity = parseFloat(values.totalQuantity);
        if (!isNaN(parsedTotalQuantity)) {
          instance_details_payload.total_quantity = parsedTotalQuantity;
        }
      }

      const payload: {
        sku: string;
        is_composite?: boolean;
        components?: Array<{
          component_sku: string;
          quantity_per_composite: number;
          instance_details?: {
            weight?: number;
            size?: string;
            net_weight?: number;
            gross_weight?: number;
          };
        }>;
        instance_details?: InstanceDetailsPayload;
      } = {
        sku: values.sku,
      };

      // Add composite-specific fields
      if (values.isComposite) {
        payload.is_composite = true;
        if (values.components && values.components.length > 0) {
          payload.components = values.components.map((component) => ({
            component_sku: component.component_sku,
            quantity_per_composite: component.quantity_per_composite,
            instance_details: {
              ...(component.weight &&
                !isNaN(parseFloat(component.weight)) && {
                  weight: parseFloat(component.weight),
                }),
              ...(component.size && { size: component.size }),
              ...(component.net_weight &&
                !isNaN(parseFloat(component.net_weight)) && {
                  net_weight: parseFloat(component.net_weight),
                }),
              ...(component.gross_weight &&
                !isNaN(parseFloat(component.gross_weight)) && {
                  gross_weight: parseFloat(component.gross_weight),
                }),
            },
          }));
        }
      }

      // Only include instance_details if it has keys
      if (Object.keys(instance_details_payload).length > 0) {
        payload.instance_details = instance_details_payload;
      }

      const response = await fetch(`/api/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.json(); // Always parse JSON response

      if (!response.ok) {
        throw new Error(responseBody.error || "Failed to add item");
      }
      return responseBody as AddItemApiResponse;
    },
    onSuccess: (data) => {
      if (data.type === "composite") {
        toast.success(`Composite item added successfully!`);
      } else {
        toast.success(`Item added successfully`);
      }
      form.reset(); // Reset form fields
      setSkuSearch(""); // Reset SKU search input
      setSelectedCompositeInfo(null); // Clear composite info
      setShowComponentInput(false); // Reset component input visibility
      // Invalidate queries to refetch relevant data
      queryClient.invalidateQueries({ queryKey: ["orderItems", orderId] }); // If you have a query for items specific to this order
      queryClient.invalidateQueries({ queryKey: ["itemsInStage"] }); // To update stage view lists

      // Invalidate the workflow sidebar query (which includes counts for the sidebar)
      queryClient.invalidateQueries({ queryKey: ["workflow", "sidebar"] });

      // Invalidate the new items count query
      queryClient.invalidateQueries({ queryKey: ["newItemsCount"] });

      // Invalidate the new order items query (for the new-orders page)
      queryClient.invalidateQueries({ queryKey: ["newOrderItems"] });

      // Invalidate the completed items count query
      queryClient.invalidateQueries({ queryKey: ["completedItemsCount"] });
      if (onItemAdded) onItemAdded(); // Call optional callback
    },
    onError: (error: Error) => {
      toast.error(`Error adding item: ${error.message}`);
    },
  });

  // 4. Handle Autocomplete Selection
  const handleSkuSelect = async (selected: SkuSuggestion | null) => {
    if (!selected) {
      // Allow clearing the selection
      form.resetField("sku");
      setSkuSearch("");
      setSelectedCompositeInfo(null);
      return;
    }

    form.setValue("sku", selected.value, { shouldValidate: true });
    setSkuSearch(selected.value); // Update search state to match selection

    // If this is a composite item, fetch its component details
    if (selected.is_composite) {
      try {
        const response = await fetch(
          "/api/composite-items?search=" + encodeURIComponent(selected.value)
        );
        if (response.ok) {
          const data = await response.json();
          const compositeItem = data.composite_items?.find(
            (item: any) => item.composite_sku === selected.value
          );
          if (compositeItem) {
            setSelectedCompositeInfo({
              sku: compositeItem.composite_sku,
              name: compositeItem.name,
              components: compositeItem.components || [],
            });
            // Pre-populate components in form with additional fields
            form.setValue("isComposite", true);
            form.setValue(
              "components",
              compositeItem.components?.map((component: any) => ({
                component_sku: component.component_sku,
                quantity_per_composite: component.quantity_per_composite,
                weight: "",
                size: "",
                net_weight: "",
                gross_weight: "",
              })) || []
            );
          }
        }
      } catch (error) {
        console.error("Error fetching composite details:", error);
      }
    } else {
      setSelectedCompositeInfo(null);
      form.setValue("isComposite", false);
      form.setValue("components", []);
    }

    // Reset other fields first to avoid merging old/new data
    form.resetField("weight");
    form.resetField("size");
    form.resetField("boxSize");
    form.resetField("cartonSize");
    form.resetField("piecesPerCarton");
    form.resetField("netWeight");
    form.resetField("grossWeight");
    form.resetField("volume");
    form.resetField("buyerId");
    form.resetField("totalQuantity");
    // Reset other instance fields...

    if (selected.master_details) {
      // Safely access properties using `unknown` or Record<string, unknown>
      const details = selected.master_details as Record<string, unknown>;

      // Existing fields
      const weight = details.weight;
      const size = details.size;
      const boxSize = details.box_size; // snake_case from DB

      form.setValue(
        "weight",
        typeof weight === "number" || typeof weight === "string"
          ? String(weight)
          : ""
      );
      form.setValue("size", typeof size === "string" ? size : "");
      form.setValue("boxSize", typeof boxSize === "string" ? boxSize : "");

      // New Fields
      const cartonSize = details.carton_size;
      const netWeight = details.net_weight;
      const grossWeight = details.gross_weight;
      const volume = details.volume;
      // pieces_per_carton is calculated, don't prefill directly unless it's stored

      form.setValue(
        "cartonSize",
        typeof cartonSize === "string" ? cartonSize : ""
      );
      form.setValue(
        "netWeight",
        typeof netWeight === "number" || typeof netWeight === "string"
          ? String(netWeight)
          : ""
      );
      form.setValue(
        "grossWeight",
        typeof grossWeight === "number" || typeof grossWeight === "string"
          ? String(grossWeight)
          : ""
      );
      form.setValue("volume", typeof volume === "string" ? volume : "");

      // Pre-fill buyerId and totalQuantity
      const buyerId = details.buyer_id;
      const totalQuantity = details.total_quantity;

      form.setValue("buyerId", typeof buyerId === "string" ? buyerId : "");
      form.setValue(
        "totalQuantity",
        typeof totalQuantity === "number" || typeof totalQuantity === "string"
          ? String(totalQuantity)
          : ""
      );
    }

    setPopoverOpen(false); // Close popover after selection
  };

  // Add useEffect for calculating piecesPerCarton
  const boxSizeValue = form.watch("boxSize");
  const cartonSizeValue = form.watch("cartonSize");

  React.useEffect(() => {
    const boxVolume = calculateVolume(boxSizeValue);
    const cartonVolume = calculateVolume(cartonSizeValue);

    if (boxVolume && cartonVolume && boxVolume > 0) {
      const pieces = Math.floor(cartonVolume / boxVolume);
      form.setValue("piecesPerCarton", pieces, { shouldValidate: true });
    } else {
      form.setValue("piecesPerCarton", null, { shouldValidate: true }); // Set to null if calculation not possible
    }
  }, [boxSizeValue, cartonSizeValue, form]);

  function onSubmit(values: FormData) {
    mutation.mutate(values);
  }

  // Helper to find the label for the selected value
  const getSelectedLabel = (selectedValue: string) => {
    return (
      skuSuggestions?.find((suggestion) => suggestion.value === selectedValue)
        ?.label ?? selectedValue // Fallback to value if label not found (e.g., new/typed)
    );
  };

  // Check if the current search term exactly matches any suggestion
  const exactMatchExists = skuSuggestions?.some(
    (s) => s.value.toLowerCase() === skuSearch.toLowerCase()
  );

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle>Add Item to Order</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem className="flex flex-col max-w-64">
                  <FormLabel>SKU *</FormLabel>
                  {/* Use Popover + Command for SKU */}
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? getSelectedLabel(field.value)
                            : "Select or type SKU..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                      <Command shouldFilter={false}>
                        {" "}
                        {/* Disable default filtering */}
                        <CommandInput
                          placeholder="Search SKU..."
                          value={skuSearch} // Controlled input
                          onValueChange={setSkuSearch} // Update search state on type
                        />
                        <CommandList>
                          {isLoadingSuggestions && (
                            <div className="p-2 text-center text-sm">
                              Loading...
                            </div>
                          )}
                          {!isLoadingSuggestions &&
                            !skuSuggestions?.length &&
                            !skuSearch && (
                              <CommandEmpty>Type to search SKUs.</CommandEmpty>
                            )}
                          {/* Show 'Create' option if typing and no exact match */}
                          {!isLoadingSuggestions &&
                            skuSearch &&
                            !exactMatchExists && (
                              <CommandItem
                                key="create-new"
                                value={`__create__${skuSearch}`}
                                onSelect={() => {
                                  form.setValue("sku", skuSearch, {
                                    shouldValidate: true,
                                  });
                                  form.resetField("weight"); // Clear details for new SKU
                                  form.resetField("size");
                                  form.resetField("boxSize");
                                  form.resetField("cartonSize");
                                  form.resetField("piecesPerCarton");
                                  form.resetField("netWeight");
                                  form.resetField("grossWeight");
                                  form.resetField("volume");
                                  form.resetField("buyerId");
                                  form.resetField("totalQuantity");
                                  setSelectedCompositeInfo(null);
                                  form.setValue("isComposite", false);
                                  form.setValue("components", []);
                                  setPopoverOpen(false);
                                }}
                              >
                                <span className="mr-2">+</span> Create &quot;
                                {skuSearch}&quot;
                              </CommandItem>
                            )}
                          {/* Display existing suggestions */}
                          <CommandGroup>
                            {skuSuggestions?.map((suggestion) => (
                              <CommandItem
                                key={suggestion.value}
                                value={suggestion.value}
                                onSelect={() => {
                                  handleSkuSelect(suggestion);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === suggestion.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center justify-between w-full">
                                  <span>{suggestion.label}</span>
                                  {suggestion.is_composite && (
                                    <div className="flex items-center text-xs text-primary bg-primary/10 px-2 py-1 rounded-md ml-2">
                                      <Layers className="h-3 w-3 mr-1" />
                                      Composite
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {/* Fallback if suggestions load but are empty for the search */}
                          {!isLoadingSuggestions &&
                            !skuSuggestions?.length &&
                            skuSearch &&
                            exactMatchExists && (
                              <CommandEmpty>
                                No other matching SKUs found.
                              </CommandEmpty>
                            )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Composite Item Checkbox */}
            <FormField
              control={form.control}
              name="isComposite"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      className=" border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white data-[state=checked]:border-primary"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue("components", []);
                          setSelectedCompositeInfo(null);
                          setShowComponentInput(false);
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>This is a composite item</FormLabel>
                    <FormDescription>
                      Check this if this item is made up of multiple
                      sub-components that need to be tracked separately.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Composite Item Preview (for existing composite items) */}
            {selectedCompositeInfo && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-primary">
                    Existing Composite Item Preview
                  </h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-primary/80">
                    <strong>Name:</strong> {selectedCompositeInfo.name}
                  </p>
                  <p className="text-sm text-primary/80">
                    <strong>Components that will be created:</strong>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedCompositeInfo.components.map(
                      (component, index) => (
                        <div
                          key={index}
                          className="bg-background rounded px-3 py-2 text-xs border border-primary/10"
                        >
                          <span className="font-medium">
                            {component.component_sku}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            ({component.quantity_per_composite}x per composite)
                          </span>
                        </div>
                      )
                    )}
                  </div>
                  <p className="text-xs text-primary bg-primary/10 p-2 rounded">
                    💡 When you submit this form, individual items will be
                    created for each component above. The total quantity entered
                    will be multiplied by each component's quantity.
                  </p>
                </div>
              </div>
            )}

            <Separator />

            <h3 className="text-lg font-semibold pt-2">Instance Details</h3>
            <FormDescription>
              Provide details specific to this item instance. If a known SKU is
              selected, these may be pre-filled but can be changed.
            </FormDescription>

            {/* Wrap instance detail fields in a grid container */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Buyer ID Field */}
              <FormField
                control={form.control}
                name="buyerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer's Item ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter Buyer's Item ID (optional)"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Total Quantity Field - Moved up for better flow if it's important */}
              <FormField
                control={form.control}
                name="totalQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Quantity</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 100"
                        {...field}
                        value={field.value ?? ""}
                        type="number" // Hint for numeric input
                        step="1" // Allow whole numbers
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Instance Detail Fields */}
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight</FormLabel>
                    <FormControl>
                      {/* Use text input for flexibility, backend handles parsing */}
                      <Input
                        placeholder="e.g., 10.5"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Large"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="boxSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Box Size (e.g., LxWxH)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 12x12x6"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Add other instance detail FormFields here */}

              {/* ---- NEW FIELDS START ---- */}
              <FormField
                control={form.control}
                name="cartonSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carton Size (e.g., LxWxH)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 40x30x20"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="piecesPerCarton"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pieces per Carton</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Auto-calculated"
                        {...field}
                        value={field.value ?? ""}
                        type="number"
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10) || null)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty for auto-calculation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="netWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Net Weight</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 9.8"
                        {...field}
                        value={field.value ?? ""}
                        type="number" // Hint for numeric input, but value is string
                        step="any" // Allow decimals
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grossWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gross Weight</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 10.2"
                        {...field}
                        value={field.value ?? ""}
                        type="number" // Hint for numeric input
                        step="any" // Allow decimals
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume (e.g., LxWxH)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 12x8x4"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional: Specify volume if different from calculated box
                      size.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* ---- NEW FIELDS END ---- */}
            </div>

            {/* Components Section - Show when showComponentInput is true */}
            {showComponentInput && (
              <div className="space-y-4 p-4 border rounded-lg bg-slate-900/50 border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-200">
                    <Layers className="inline h-5 w-5 mr-2" />
                    Component Items
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        component_sku: "",
                        quantity_per_composite: 1,
                        weight: "",
                        size: "",
                        net_weight: "",
                        gross_weight: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Component
                  </Button>
                </div>

                <FormDescription className="text-slate-400">
                  Define which components make up this composite item. Each
                  component will inherit the quantity from the total quantity
                  field above.
                </FormDescription>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-4 bg-slate-800/50 rounded border border-slate-600 space-y-4"
                  >
                    {/* First row: SKU and Quantity */}
                    <div className="flex items-end space-x-2">
                      <FormField
                        control={form.control}
                        name={`components.${index}.component_sku`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Component SKU</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter component SKU"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`components.${index}.quantity_per_composite`}
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormLabel>Qty per Composite</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                placeholder="1"
                                {...field}
                                value={
                                  watchedTotalQuantity
                                    ? parseInt(watchedTotalQuantity) || 1
                                    : field.value
                                }
                                readOnly
                                className="bg-slate-800/50 text-slate-300"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              Inherited from total quantity
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Second row: Component details */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-slate-700">
                      <FormField
                        control={form.control}
                        name={`components.${index}.weight`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 10.5"
                                {...field}
                                value={field.value ?? ""}
                                type="number"
                                step="any"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`components.${index}.size`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Size</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Large"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`components.${index}.net_weight`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Net Weight</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 9.8"
                                {...field}
                                value={field.value ?? ""}
                                type="number"
                                step="any"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`components.${index}.gross_weight`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gross Weight</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 10.2"
                                {...field}
                                value={field.value ?? ""}
                                type="number"
                                step="any"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}

                {fields.length === 0 && (
                  <div className="text-center py-4 text-slate-400">
                    <p>
                      No components added yet. Click "Add Component" to get
                      started.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              className="bg-primary text-white"
              type={isComposite && !showComponentInput ? "button" : "submit"}
              disabled={mutation.isPending}
              onClick={
                isComposite && !showComponentInput
                  ? () => {
                      // Show component input section and add first component
                      setShowComponentInput(true);
                      append({
                        component_sku: "",
                        quantity_per_composite: 1,
                        weight: "",
                        size: "",
                        net_weight: "",
                        gross_weight: "",
                      });
                    }
                  : undefined
              }
            >
              {mutation.isPending
                ? "Adding..."
                : isComposite && !showComponentInput
                  ? "Add Sub-Items"
                  : showComponentInput
                    ? "Create Composite Item"
                    : "Add Item"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
