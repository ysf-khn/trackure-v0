"use client";

import React from "react";
import { WorkflowEditor } from "@/components/settings/workflow-editor";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, SettingsIcon } from "lucide-react";

const SettingsPage = () => {
  const {
    organizationId,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useProfileAndOrg();

  // Only show error states, let loading.tsx handle loading
  if (profileError) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Settings</AlertTitle>
          <AlertDescription>
            There was a problem fetching your organization details:{" "}
            {profileError || "Unknown error"}. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isLoadingProfile && !organizationId) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Organization Not Found</AlertTitle>
          <AlertDescription>
            We couldn't find an organization associated with your account.
            Please ensure you have set up or joined an organization.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Don't render anything while loading - let loading.tsx handle it
  if (isLoadingProfile || !organizationId) {
    return null;
  }

  return (
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-8">
        {/* Future: Add more settings sections here, e.g., Profile, Billing, Team */}

        <section id="workflow-settings">
          <h2 className="text-2xl font-semibold mb-4">Workflow Management</h2>
          <WorkflowEditor organizationId={organizationId} />
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
