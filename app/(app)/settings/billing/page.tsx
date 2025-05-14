"use client";

import React from "react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, CreditCardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const BillingSettingsPage = () => {
  const { organizationId, organizationName, isLoading, error, refetch } =
    useProfileAndOrg();

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
        <div className="flex items-center space-x-3 mb-8">
          <CreditCardIcon className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold">Billing & Subscription</h1>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3 mb-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <CreditCardIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        </div>
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Billing Information</AlertTitle>
          <AlertDescription>
            There was a problem fetching your billing details:{" "}
            {error || "Unknown error"}. Please try refreshing the page or{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => refetch()}
            >
              try again
            </Button>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <CreditCardIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        </div>
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Organization Not Found</AlertTitle>
          <AlertDescription>
            Billing information is typically associated with an organization. We
            couldn't find an organization for your account. Please ensure you
            have set up or joined an organization, or{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => refetch()}
            >
              try reloading
            </Button>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Placeholder data/logic
  const currentPlan = "Free Trial (5 Days Remaining)";
  const nextBillingDate = "June 2, 2025";
  const paymentMethod = "Visa ending in 1234";

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
      <div className="flex items-center space-x-3">
        <CreditCardIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          {organizationName && (
            <CardDescription>Organization: {organizationName}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{currentPlan}</h3>
            <p className="text-muted-foreground">
              Trail End Date: {nextBillingDate}
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button>Change Plan</Button>
            <Button variant="outline">Cancel Subscription</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{paymentMethod}</p>
          <Button variant="secondary">Update Payment Method</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View your past invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder for billing history table or list */}
          <p className="text-muted-foreground">
            No billing history available yet. Past invoices will appear here.
          </p>
          {/* <Button variant="link">View All Invoices</Button> */}
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSettingsPage;
