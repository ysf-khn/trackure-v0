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
import { Info, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// Checkbox import removed - packaging reminders coming soon
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { TooltipContent } from "@/components/ui/tooltip";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

// Define Zod schema based on Task 1.2 (assuming required fields)
const orderFormSchema = z.object({
  order_number: z.string().min(1, "Order Number is required"),
  customer_name: z.string().min(1, "Customer Name is required"),
  total_quantity: z.coerce
    .number()
    .int()
    .positive("Total quantity must be greater than0"),
  // Packaging reminder fields removed - coming soon
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

// Packaging materials constants removed - coming soon

// Function to post data to the API
async function createOrder(orderData: OrderFormValues) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
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
      total_quantity: 0,
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
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <h1 className="text-xl font-semibold">Create New Order</h1>
        </div>
      </div>

      <div className="px-4 md:px-6">
        <Card className="w-full max-w-3xl mx-auto mb-4">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              Fill in the details below to create a new order. Individual items
              and their specific quantities can be added after the order is
              created.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <CardContent className="space-y-6">
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
                      <div className="flex items-center gap-1">
                        <FormLabel>Total Quantity of Items</FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground">
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>
                                This is the total quantity of items that will be
                                added to the order. Eg: If the order is for 100
                                units of Item A, and 50 units of Item B, then
                                the total quantity would be 150.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
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

                {/* --- Packaging Reminders (Coming Soon) --- */}
                <div className="space-y-4">
                  <div className="border rounded-lg p-6 bg-muted/50">
                    <div className="flex items-center space-x-2 mb-3">
                      <h3 className="text-lg font-medium">
                        📦 Packaging Reminders
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        Coming Soon
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Automatically get notified when it's time to order
                      packaging materials based on your order progress.
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-muted-foreground/40 rounded-full"></div>
                        <span>
                          Define required packaging materials per order
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-muted-foreground/40 rounded-full"></div>
                        <span>Set trigger stages for automatic reminders</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-muted-foreground/40 rounded-full"></div>
                        <span>
                          Email notifications with lead time considerations
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={
                    mutation.isPending || isWorkflowSelectLoading || !isMounted
                  }
                  className="w-full md:w-auto"
                >
                  {mutation.isPending ? "Creating..." : "Create Order"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
