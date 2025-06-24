"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Workflow } from "lucide-react";
import { WorkflowEditor } from "@/components/settings/workflow-editor";
import { OnboardingProgress } from "../layout";

// Define expected profile structure
interface UserProfile {
  id: string;
  organization_id: string | null;
  onboarding_status: string;
  // Add other fields if needed
}

// API call function to get user profile
async function fetchUserProfile(): Promise<UserProfile> {
  const response = await fetch("/api/profiles/me");
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch user profile.");
  }
  return response.json();
}

// API call function to advance onboarding
async function advanceOnboarding(): Promise<{ success: boolean }> {
  const response = await fetch("/api/onboarding/advance", {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to advance onboarding step.");
  }
  return response.json();
}

export default function WorkflowSetupPage() {
  const router = useRouter();

  // Fetch user profile to get organization ID
  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isErrorProfile,
    error: profileError,
  } = useQuery<UserProfile, Error>({
    queryKey: ["userProfileOnboarding"],
    queryFn: fetchUserProfile,
  });

  // Mutation to advance the onboarding status
  const advanceMutation = useMutation<{ success: boolean }, Error, void>({
    mutationFn: advanceOnboarding,
    onSuccess: () => {
      toast.success("Setup complete! Welcome to Trakure!");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error("Error Completing Setup", { description: error.message });
    },
  });

  const handleAdvance = () => {
    advanceMutation.mutate();
  };

  const stepTitles = ["Your Profile", "Organization", "Workflow Setup"];

  // --- Loading State ---
  if (isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <OnboardingProgress
          currentStep={3}
          totalSteps={3}
          stepTitles={stepTitles}
        />
        <div className="w-full max-w-4xl p-8 space-y-6 bg-card rounded-lg shadow-md">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-5 w-2/3 mb-6" />
          <Skeleton className="h-64 w-full border rounded-md p-4" />
          <div className="flex justify-end space-x-4 mt-6">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (isErrorProfile || !profile?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <OnboardingProgress
          currentStep={3}
          totalSteps={3}
          stepTitles={stepTitles}
        />
        <Alert variant="destructive" className="max-w-lg">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {profileError?.message ||
              "Could not load organization details. Please ensure you have created an organization."}
            <br />
            <Button variant="link" onClick={() => router.push("/organization")}>
              Go back to Organization Setup
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Success State ---
  const organizationId = profile.organization_id; // Already checked for null above

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-120px)] py-8">
      {/* Progress Indicator */}
      <OnboardingProgress
        currentStep={3}
        totalSteps={3}
        stepTitles={stepTitles}
      />

      {/* Main Content */}
      <div className="w-full max-w-5xl p-8 space-y-6 bg-card text-card-foreground rounded-lg shadow-md">
        <div className="text-center space-y-4 mb-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="p-3 bg-primary/20 rounded-full">
              <Workflow className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Define Your Workflow
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
              Set up the stages and optional sub-stages your items will move
              through. This defines how work flows in your organization. You can
              customize this further later in Settings.
            </p>
          </div>
        </div>

        {/* Embed the WorkflowEditor */}
        <div className="bg-card/50 rounded-lg p-6 border">
          <WorkflowEditor organizationId={organizationId} />
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleAdvance}
            disabled={advanceMutation.isPending}
          >
            Complete Setup Later
          </Button>
          <Button
            onClick={handleAdvance}
            disabled={advanceMutation.isPending}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white shadow-sm"
          >
            {advanceMutation.isPending
              ? "Completing Setup..."
              : "Complete Setup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
