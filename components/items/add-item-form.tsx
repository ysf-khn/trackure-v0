"use client";

import * as React from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { useDebounce } from "@/hooks/queries/use-debounce";

// Helper function to parse dimension strings (e.g., "LxWxH") and calculate volume
const calculateVolume = (sizeString: string | undefined): number | null => {
  if (!sizeString) return null;
  const dimensions = sizeString
    .toLowerCase()
    .split("x")
    .map((d) => parseFloat(d.trim()))
    .filter((d) => !isNaN(d));
  if (dimensions.length !== 3) return null; // Expecting 3 dimensions
  return dimensions[0] * dimensions[1] * dimensions[2];
};

// Zod schema for form validation
const formSchema = z.object({
  sku: z.string().min(1, { message: "SKU is required." }),
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

// Type for Autocomplete suggestions (needs value and label for combobox pattern)
type SkuSuggestion = {
  value: string; // Typically the SKU itself
  label: string; // User-friendly display (e.g., SKU - Name)
  master_details?: Record<string, unknown>; // Details to pre-fill (JSONB)
};

// Explicit type for the API response
type AddItemApiResponse = {
  message: string;
  itemId: string;
};

export function AddItemForm({ orderId, onItemAdded }: AddItemFormProps) {
  const queryClient = useQueryClient();

  // 1. Form Setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      weight: "",
      size: "",
      boxSize: "",
      cartonSize: "",
      piecesPerCarton: null, // Initialize as null
      netWeight: "",
      grossWeight: "",
      volume: "",
      buyerId: "", // Initialize buyerId
      totalQuantity: "", // Initialize totalQuantity
      // Initialize other fields
    },
  });

  // 2. SKU Autocomplete State & Query
  const [skuSearch, setSkuSearch] = React.useState("");
  // Use the current SKU form field value for debouncing if user types directly
  const debouncedSkuSearch = useDebounce(skuSearch, 300);
  const [popoverOpen, setPopoverOpen] = React.useState(false); // State for Popover

  // Explicitly type the useQuery result
  const {
    data: skuSuggestions,
    isLoading: isLoadingSuggestions,
  }: UseQueryResult<SkuSuggestion[], Error> = useQuery<SkuSuggestion[], Error>({
    queryKey: ["skuSearch", debouncedSkuSearch], // Correct query key format
    queryFn: async () => {
      if (!debouncedSkuSearch) return [];
      const response = await fetch(
        `/api/item-master/search?q=${encodeURIComponent(debouncedSkuSearch)}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch SKU suggestions");
      }
      const data = await response.json();
      // Ensure data is always an array
      return Array.isArray(data) ? data : [];
    },
    enabled: !!debouncedSkuSearch, // Only run query if search term exists
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    retry: false, // Don't retry on failure for search
  });

  // 3. Mutation Setup (for submitting the form)
  const mutation = useMutation<
    AddItemApiResponse,
    Error,
    z.infer<typeof formSchema>
  >({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
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
        instance_details?: InstanceDetailsPayload;
      } = {
        sku: values.sku,
      };
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
      toast.success(`Item added successfully (ID: ${data.itemId})`);
      form.reset(); // Reset form fields
      setSkuSearch(""); // Reset SKU search input
      // Invalidate queries to refetch relevant data
      queryClient.invalidateQueries({ queryKey: ["orderItems", orderId] }); // If you have a query for items specific to this order
      queryClient.invalidateQueries({ queryKey: ["itemsInStage"] }); // To update stage view lists

      // Invalidate the workflow sidebar query (which includes counts for the sidebar)
      queryClient.invalidateQueries({ queryKey: ["workflow", "sidebar"] });

      // Invalidate the new items count query
      queryClient.invalidateQueries({ queryKey: ["newItemsCount"] });

      // Invalidate the completed items count query
      queryClient.invalidateQueries({ queryKey: ["completedItemsCount"] });
      if (onItemAdded) onItemAdded(); // Call optional callback
    },
    onError: (error: Error) => {
      toast.error(`Error adding item: ${error.message}`);
    },
  });

  // 4. Handle Autocomplete Selection
  const handleSkuSelect = (selected: SkuSuggestion | null) => {
    if (!selected) {
      // Allow clearing the selection
      form.resetField("sku");
      setSkuSearch("");
      return;
    }

    form.setValue("sku", selected.value, { shouldValidate: true });
    setSkuSearch(selected.value); // Update search state to match selection

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

      // Trigger calculation after potentially pre-filling box/carton sizes
      // (Will be handled by useEffect watching these fields)
    }
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

  // 5. Form Submit Handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    // console.log('Form submitted:', values);
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
                                {suggestion.label}
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

            <h3 className="text-lg font-semibold pt-2">
              Instance Details (Optional Overrides)
            </h3>
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
                    <FormLabel>Pieces per Carton (Calculated)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Auto-calculated"
                        {...field}
                        value={field.value === null ? "" : String(field.value)} // Display calculated value or empty
                        readOnly // Make this field read-only
                        className="bg-muted" // Optional: style to indicate read-only
                      />
                    </FormControl>
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

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Adding..." : "Add Item"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
