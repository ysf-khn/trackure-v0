"use client";

import React from "react";
import { WorkflowEditor } from "@/components/settings/workflow-editor";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, SettingsIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const SettingsPage = () => {
  const {
    organizationId,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useProfileAndOrg();

  if (isLoadingProfile) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <Skeleton className="h-96 w-full border rounded-md p-4" />
      </div>
    );
  }

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

  if (!organizationId) {
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

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
      <div className="flex items-center space-x-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Future: Add more settings sections here, e.g., Profile, Billing, Team */}

      <section id="workflow-settings">
        <h2 className="text-2xl font-semibold mb-4">Workflow Management</h2>
        <WorkflowEditor organizationId={organizationId} />
      </section>

      {/* Example of another settings section placeholder */}
      {/*
      <section id="profile-settings">
        <h2 className="text-2xl font-semibold mb-4">Profile Settings</h2>
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Profile editing form will go here.</p>
          </CardContent>
        </Card>
      </section>
      */}
    </div>
  );
};

export default SettingsPage;
