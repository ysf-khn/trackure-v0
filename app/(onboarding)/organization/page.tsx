"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { Building2 } from "lucide-react";

// Schema for the form
const formSchema = z.object({
  organizationName: z
    .string()
    .min(2, { message: "Organization name must be at least 2 characters." })
    .max(50, { message: "Organization name must be at most 50 characters." }),
});

type FormData = z.infer<typeof formSchema>;

// Define the expected API response structure
interface CreateOrganizationResponse {
  success: boolean;
  organizationId: string;
  // Add other fields if the API returns more data
}

// API call function
async function createOrganization(
  data: FormData
): Promise<CreateOrganizationResponse> {
  const response = await fetch("/api/organizations/setup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json();

  if (!response.ok) {
    // Try to extract the error message from the API response
    const errorMessage =
      typeof responseData.error === "string"
        ? responseData.error
        : Array.isArray(responseData.error) &&
            responseData.error.length > 0 &&
            typeof responseData.error[0].message === "string"
          ? responseData.error[0].message // Handle Zod error array
          : "Failed to create organization. Please try again.";
    throw new Error(errorMessage);
  }

  return responseData as CreateOrganizationResponse; // Assert type on success
}

export default function OrganizationSetupPage() {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organizationName: "",
    },
  });

  const mutation = useMutation<CreateOrganizationResponse, Error, FormData>({
    mutationFn: createOrganization,
    onSuccess: () => {
      toast.success("Organization created!");
      router.push("/setup-workflow");
    },
    onError: (error: Error) => {
      toast.error("Error Creating Organization", {
        description: error.message,
      });
      console.error("Organization creation failed:", error); // Log the error
    },
  });

  function onSubmit(values: FormData) {
    mutation.mutate(values);
  }

  const stepTitles = ["Your Profile", "Organization", "Workflow Setup"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      {/* Progress Indicator */}
      <OnboardingProgress
        currentStep={2}
        totalSteps={3}
        stepTitles={stepTitles}
      />

      {/* Main Content */}
      <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-lg shadow-md">
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="p-3 bg-primary/20 rounded-full">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Create Your Organization
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Give your workspace a name that represents your business.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="organizationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Acme Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white shadow-sm"
              disabled={mutation.isPending}
              size="lg"
            >
              {mutation.isPending ? "Creating..." : "Create & Continue"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
