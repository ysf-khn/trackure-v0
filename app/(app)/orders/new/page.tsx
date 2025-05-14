"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

// Define Zod schema based on Task 1.2 (assuming required fields)
const orderFormSchema = z.object({
  order_number: z.string().min(1, "Order Number is required"),
  customer_name: z.string().min(1, "Customer Name is required"),
  total_quantity: z.coerce
    .number()
    .int()
    .positive("Total quantity must be greater than0"),
  // Add other fields as needed based on PRD
  required_packaging_materials: z.array(z.string()).optional(), // Make optional, rely on defaultValues
  custom_packaging_material: z.string().optional(), // Temporary field for the input
  packaging_reminder_trigger: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

const COMMON_PACKAGING_MATERIALS = [
  "Box Type A",
  "Box Type B",
  "Bubble Wrap",
  "Packing Tape",
  "Foam Peanuts",
  "Fragile Sticker",
  "Velvet Box",
];

// Function to post data to the API
async function createOrder(orderData: OrderFormValues) {
  // Destructure to remove the temporary custom field before sending
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { custom_packaging_material: _unusedCustom, ...payloadToSend } =
    orderData;

  const apiPayload = {
    ...payloadToSend, // Use the destructured payload
    // No need to split/map required_packaging_materials, it's already an array
    packaging_reminder_trigger_stage_id:
      orderData.packaging_reminder_trigger?.startsWith("stage:") &&
      orderData.packaging_reminder_trigger !== "none" // Check for "none"
        ? orderData.packaging_reminder_trigger.split(":")[1]
        : undefined,
    packaging_reminder_trigger_sub_stage_id:
      orderData.packaging_reminder_trigger?.startsWith("sub_stage:") &&
      orderData.packaging_reminder_trigger !== "none" // Check for "none"
        ? orderData.packaging_reminder_trigger.split(":")[1]
        : undefined,
  };
  // Remove the combined trigger field before sending
  // Prefix with underscore to silence linter warning about unused variable
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { packaging_reminder_trigger: _unusedTrigger, ...finalPayload } =
    apiPayload; // Use object destructuring instead

  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(finalPayload), // Use the final payload
  });

  if (!response.ok) {
    // Attempt to parse error response, otherwise throw generic error
    try {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    } catch {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  return response.json();
}

export default function NewOrderPage() {
  const router = useRouter();
  const {
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();

  // State to track client-side mounting
  const [isMounted, setIsMounted] = useState(false);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_number: "",
      customer_name: "",
      total_quantity: 0, // Default to 1
      required_packaging_materials: [], // Default to empty array
      custom_packaging_material: "", // Default custom input
      packaging_reminder_trigger: undefined,
    },
  });

  // Effect to set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use the actual organizationId from the hook
  // Assert non-null (!) because preceding checks ensure it's defined here
  const {
    data: workflowResultData, // Rename data to avoid conflict
    isLoading: isLoadingWorkflow,
    error: workflowError,
  } = useWorkflowStructure(organizationId!); // Use non-null assertion

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (data) => {
      console.log("Order created successfully:", data);
      toast.success(`Order ${data.order_number} created successfully!`);
      // Redirect on success (as per task 1.4)
      // Assuming the API returns the new order with an `id`
      // and we redirect to the detail page `/orders/[id]`
      router.push(`/orders/${data.id}`);
      // Resetting the form might not be necessary if redirecting
      // form.reset();
    },
    onError: (error) => {
      console.error("Failed to create order:", error);
      toast.error(`Failed to create order: ${error.message}`);
    },
  });

  function onSubmit(data: OrderFormValues) {
    mutation.mutate(data);
  }

  // --- Loading State --- //
  if (isAuthLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-24" />
        </CardFooter>
      </Card>
    );
  }

  // --- Error States --- //
  if (authError) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Authentication Error</AlertTitle>
        <AlertDescription>
          Could not load user data: {authError}
        </AlertDescription>
      </Alert>
    );
  }

  if (!organizationId) {
    return (
      <Alert className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Missing Organization</AlertTitle>
        <AlertDescription>
          User organization could not be determined. Cannot create order.
        </AlertDescription>
      </Alert>
    );
  }

  if (workflowError) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Workflow</AlertTitle>
        <AlertDescription>
          Could not load workflow structure: {workflowError.message}
        </AlertDescription>
      </Alert>
    );
  }

  // --- Form Rendering (Main Content) --- //
  const isWorkflowSelectLoading = isAuthLoading || isLoadingWorkflow;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Order</CardTitle>
        <CardDescription>
          Fill in the details below to create a new order. Individual items and
          their specific quantities can be added after the order is created.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="order_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter order number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buyer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter buyer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Quantity of Items</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter total quantity"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 0)
                      } // Ensure value is number
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Add more FormField components for other order details */}

            {/* --- Required Packaging Materials --- */}
            <FormField
              control={form.control}
              name="required_packaging_materials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required Packaging Materials</FormLabel>
                  <div className="space-y-2">
                    <FormLabel className="text-sm font-normal text-muted-foreground">
                      Common Materials:
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {COMMON_PACKAGING_MATERIALS.map((material) => (
                        <FormField
                          key={material}
                          control={form.control} // Inner FormField for checkbox state
                          name="required_packaging_materials" // Bind to the same array
                          render={({ field: checkboxField }) => {
                            const isChecked =
                              checkboxField.value?.includes(material);
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentMaterials =
                                        checkboxField.value || [];
                                      if (checked) {
                                        checkboxField.onChange([
                                          ...currentMaterials,
                                          material,
                                        ]);
                                      } else {
                                        checkboxField.onChange(
                                          currentMaterials.filter(
                                            (m) => m !== material
                                          )
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {material}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <FormLabel className="text-sm font-normal text-muted-foreground">
                      Custom Material:
                    </FormLabel>
                    <div className="flex items-center space-x-2">
                      <FormField
                        control={form.control}
                        name="custom_packaging_material" // Separate field for input
                        render={({ field: customField }) => (
                          <FormControl>
                            <Input
                              placeholder="Enter custom material name"
                              {...customField}
                            />
                          </FormControl>
                        )}
                      />
                      <Button
                        type="button" // Prevent form submission
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const customMaterial = form
                            .getValues("custom_packaging_material")
                            ?.trim();
                          const currentMaterials = field.value || [];
                          if (
                            customMaterial &&
                            !currentMaterials.includes(customMaterial)
                          ) {
                            field.onChange([
                              ...currentMaterials,
                              customMaterial,
                            ]);
                            form.setValue("custom_packaging_material", ""); // Clear input
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <FormLabel className="text-sm font-normal text-muted-foreground">
                      Selected Materials:
                    </FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {field.value && field.value.length > 0 ? (
                        field.value.map((material) => (
                          <Badge key={material} variant="secondary">
                            {material}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No materials selected.
                        </p>
                      )}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="packaging_reminder_trigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Send Packaging Reminder When Items Reach:
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isWorkflowSelectLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        {isWorkflowSelectLoading || !isMounted ? (
                          <span className="text-muted-foreground">
                            Loading workflow...
                          </span>
                        ) : (
                          <SelectValue placeholder="Select a stage or sub-stage..." />
                        )}
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Only render content if mounted and not loading */}
                      {isMounted && !isWorkflowSelectLoading && (
                        <>
                          <SelectItem value="none">
                            -- No Reminder --
                          </SelectItem>
                          {/* Use flatMap to avoid React.Fragment inside SelectContent */}
                          {workflowResultData?.flatMap((stage) => [
                            <SelectItem
                              key={`stage:${stage.id}`}
                              value={`stage:${stage.id}`}
                            >
                              Stage: {stage.name}
                            </SelectItem>,
                            ...(stage.sub_stages?.map((subStage) => (
                              <SelectItem
                                key={`sub_stage:${subStage.id}`}
                                value={`sub_stage:${subStage.id}`}
                                className="pl-8"
                              >
                                Sub-stage: {stage.name} &gt; {subStage.name}
                              </SelectItem>
                            )) || []), // Handle potentially null/undefined sub-stages
                          ])}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending || isWorkflowSelectLoading || !isMounted
              }
            >
              {mutation.isPending ? "Creating..." : "Create Order"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
