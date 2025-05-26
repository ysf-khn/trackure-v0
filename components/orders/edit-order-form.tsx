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
// Textarea, Select, and useWorkflowStructure imports removed - packaging reminders coming soon
// import { getOrderQueryKey } from "@/hooks/queries/use-order"; // Assuming this exists - Temporarily commented out
// import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure"; // Removed unused import

// Define Zod schema (packaging reminders disabled - coming soon)
const orderFormSchema = z.object({
  order_number: z.string().min(1, "Order Number is required"),
  customer_name: z.string().min(1, "Customer Name is required"),
  // Packaging reminder fields removed - coming soon
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
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH", // Use PATCH for partial updates
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
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

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_number: initialData.order_number || "",
      customer_name: initialData.customer_name || "",
    },
  });

  // Workflow structure fetching removed - packaging reminders coming soon

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

            {/* Packaging Reminders (Coming Soon) */}
            <div className="space-y-4">
              <div className="border rounded-lg p-6 bg-muted/50">
                <div className="flex items-center space-x-2 mb-3">
                  <h3 className="text-lg font-medium">
                    📦 Packaging Reminders
                  </h3>
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Packaging reminder settings will be available in a future
                  update.
                </p>
              </div>
            </div>

            {/* TODO: Add other editable fields here */}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={mutation.isPending}>
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
