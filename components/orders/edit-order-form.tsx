"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
// import { getOrderQueryKey } from "@/hooks/queries/use-order"; // Assuming this exists - Temporarily commented out
// import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure"; // Removed unused import

// Define Zod schema (same as new order page)
const orderFormSchema = z.object({
  order_number: z.string().min(1, "Order Number is required"),
  customer_name: z.string().min(1, "Customer Name is required"),
  required_packaging_materials: z.string().optional(),
  packaging_reminder_trigger: z.string().optional(),
  // TODO: Add other fields if necessary for editing
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

// Define the shape of the initial data prop expected from the server component
// Adjust based on actual 'orders' table structure
interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  organization_id: string;
  required_packaging_materials: string[] | null;
  packaging_reminder_trigger_stage_id: string | null;
  packaging_reminder_trigger_sub_stage_id: string | null;
  // Add other fields present in the order record
}

interface EditOrderFormProps {
  initialData: OrderData;
}

// Function to patch data to the API
async function updateOrder({
  orderId,
  orderData,
}: {
  orderId: string;
  orderData: OrderFormValues;
}) {
  // Prepare data for API (similar transformation as createOrder)
  const apiPayload = {
    ...orderData,
    required_packaging_materials:
      orderData.required_packaging_materials
        ?.split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0) || null, // Handle empty string -> null
    packaging_reminder_trigger_stage_id:
      orderData.packaging_reminder_trigger?.startsWith("stage:")
        ? orderData.packaging_reminder_trigger.split(":")[1]
        : null, // Explicitly set null if not stage
    packaging_reminder_trigger_sub_stage_id:
      orderData.packaging_reminder_trigger?.startsWith("sub_stage:")
        ? orderData.packaging_reminder_trigger.split(":")[1]
        : null, // Explicitly set null if not sub-stage
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { packaging_reminder_trigger: _unusedTrigger, ...payloadToSend } =
    apiPayload;

  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH", // Use PATCH for partial updates
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payloadToSend),
  });

  if (!response.ok) {
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

export function EditOrderForm({ initialData }: EditOrderFormProps) {
  const queryClient = useQueryClient();
  const orderId = initialData.id;
  const organizationId = initialData.organization_id;

  // Helper to derive the combined trigger value for the form
  const getInitialTriggerValue = () => {
    if (initialData.packaging_reminder_trigger_stage_id) {
      return `stage:${initialData.packaging_reminder_trigger_stage_id}`;
    }
    if (initialData.packaging_reminder_trigger_sub_stage_id) {
      return `sub_stage:${initialData.packaging_reminder_trigger_sub_stage_id}`;
    }
    return ""; // No reminder set
  };

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_number: initialData.order_number || "",
      customer_name: initialData.customer_name || "",
      required_packaging_materials:
        initialData.required_packaging_materials?.join(", ") || "", // Join array to string
      packaging_reminder_trigger: getInitialTriggerValue(), // Set combined trigger value
      // Initialize other fields from initialData if needed
    },
  });

  // Fetch workflow structure
  const { data: workflowData, isLoading: isLoadingWorkflow } =
    useWorkflowStructure(organizationId);

  // Setup mutation
  const mutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: () => {
      toast.success(`Order ${initialData.order_number} updated successfully!`);
      // Invalidate relevant queries to refetch fresh data
      // queryClient.invalidateQueries({ queryKey: getOrderQueryKey(orderId) }); // Temporarily commented out
      queryClient.invalidateQueries({ queryKey: ["orders"] }); // Invalidate list of orders (if exists)
      // Optionally redirect or refresh
      // router.refresh(); // Refresh server components on the page
    },
    onError: (error) => {
      console.error("Failed to update order:", error);
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  function onSubmit(data: OrderFormValues) {
    mutation.mutate({ orderId, orderData: data });
  }

  return (
    <Card>
      {" "}
      {/* Using Card for consistency, adjust as needed */}
      <CardHeader>
        <CardTitle>Edit Order Details</CardTitle>
        <CardDescription>Modify the order information below.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <CardContent className="space-y-4">
            {/* Basic Info Fields */}
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
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Packaging Fields */}
            <FormField
              control={form.control}
              name="required_packaging_materials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required Packaging Materials</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter required materials, separated by commas (e.g., Box Type A, Bubble Wrap, Tape)"
                      {...field}
                    />
                  </FormControl>
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
                    value={field.value} // Use controlled value
                    disabled={isLoadingWorkflow}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a stage or sub-stage..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">-- No Reminder --</SelectItem>
                      {workflowData?.map((stage) => (
                        <React.Fragment key={`stage_group_${stage.id}`}>
                          <SelectItem
                            key={`stage:${stage.id}`}
                            value={`stage:${stage.id}`}
                          >
                            Stage: {stage.name}
                          </SelectItem>
                          {stage.sub_stages?.map((subStage) => (
                            <SelectItem
                              key={`sub_stage:${subStage.id}`}
                              value={`sub_stage:${subStage.id}`}
                              className="pl-8"
                            >
                              Sub-stage: {stage.name} &gt; {subStage.name}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TODO: Add other editable fields here */}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || isLoadingWorkflow}
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            {/* Optional: Add a Cancel button */}
            {/* <Button type="button" variant="outline" onClick={() => router.back()} className="ml-2">Cancel</Button> */}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
