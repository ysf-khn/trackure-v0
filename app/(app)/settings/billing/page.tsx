"use client";

import React, { useState } from "react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import useSubscription from "@/hooks/queries/use-subscription";
import { plans } from "@/lib/plans";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Terminal,
  CreditCardIcon,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Crown,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BillingSettingsPage = () => {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const {
    organizationId,
    organizationName,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfileAndOrg();
  const {
    subscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();

  const isLoading = profileLoading || subscriptionLoading;
  const error = profileError || subscriptionError;

  // Helper function to get plan details from product ID
  const getPlanDetails = (productId: string) => {
    for (const plan of plans) {
      if (plan.monthlyProductId === productId) {
        return {
          name: plan.title.charAt(0) + plan.title.slice(1).toLowerCase(),
          tenure: "Monthly",
          isMonthly: true,
        };
      }
      if (plan.annualProductId === productId) {
        return {
          name: plan.title.charAt(0) + plan.title.slice(1).toLowerCase(),
          tenure: "Annual",
          isMonthly: false,
        };
      }
    }
    return {
      name: "Unknown Plan",
      tenure: "Unknown",
      isMonthly: null,
    };
  };

  // Helper function to format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount / 100); // Convert from cents to dollars
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper function to get status badge variant and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "active":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          text: "Active",
        };
      case "cancelled":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          text: "Cancelled",
        };
      case "pending":
        return { variant: "secondary" as const, icon: Clock, text: "Pending" };
      case "on_hold":
      case "paused":
        return {
          variant: "outline" as const,
          icon: AlertTriangle,
          text: "Paused",
        };
      case "failed":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          text: "Failed",
        };
      case "expired":
        return {
          variant: "secondary" as const,
          icon: XCircle,
          text: "Expired",
        };
      default:
        return { variant: "secondary" as const, icon: Clock, text: status };
    }
  };

  // Helper function to get billing frequency text
  const getBillingFrequency = (interval: string, count: number) => {
    const unit = interval.toLowerCase();
    if (count === 1) {
      return `Every ${unit}`;
    }
    return `Every ${count} ${unit}s`;
  };

  // Function to handle customer portal redirect
  const handleManageSubscription = async () => {
    if (!subscription?.customer?.customer_id) {
      console.error("No customer ID available");
      return;
    }

    setIsLoadingPortal(true);
    try {
      const response = await fetch("/api/customer-portal/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: subscription.customer.customer_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Redirect to the customer portal
      if (data.link) {
        toast.success("Redirecting to customer portal...");
        window.open(data.link, "_blank");
      }
    } catch (error) {
      console.error("Error creating customer portal session:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error creating customer portal session. Please try again later."
      );
    } finally {
      setIsLoadingPortal(false);
    }
  };

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
              onClick={() => {
                refetchProfile();
                refetchSubscription();
              }}
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
              onClick={() => refetchProfile()}
            >
              try reloading
            </Button>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No subscription case
  if (!subscription) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <CreditCardIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Billing & Subscription</h1>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 pb-8 space-y-8">
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>No Active Subscription</AlertTitle>
            <AlertDescription>
              You don't have an active subscription yet. Browse our plans to get
              started.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Choose a plan that fits your business needs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href="/subscribe">View Plans</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(subscription.status);
  const StatusIcon = statusDisplay.icon;
  const planDetails = getPlanDetails(subscription.product_id);

  // Calculate remaining trial days
  const calculateRemainingTrialDays = () => {
    if (subscription.trial_period_days <= 0) return 0;

    const createdDate = new Date(subscription.created_at);
    const currentDate = new Date();
    const daysPassed = Math.floor(
      (currentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const remainingDays = subscription.trial_period_days - daysPassed;

    return Math.max(0, remainingDays);
  };

  const remainingTrialDays = calculateRemainingTrialDays();

  return (
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center space-x-3">
            <CreditCardIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Billing & Subscription</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Subscription
              <Badge
                variant={statusDisplay.variant}
                className={`flex items-center gap-1 ${
                  statusDisplay.variant === "default" ? "bg-green-500" : ""
                }`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusDisplay.text}
              </Badge>
            </CardTitle>
            {organizationName && (
              <CardDescription>
                Organization: {organizationName}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {remainingTrialDays > 0 && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex-shrink-0">
                  <Crown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Trial Period Active
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {remainingTrialDays}{" "}
                    {remainingTrialDays === 1 ? "day" : "days"} remaining to
                    explore all features
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Plan
                </h3>
                <p className="text-lg font-semibold">{planDetails.name}</p>
                <p className="text-sm text-muted-foreground">
                  {planDetails.tenure} billing
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Amount
                </h3>
                <p className="text-lg font-semibold">
                  {formatCurrency(
                    subscription.recurring_pre_tax_amount,
                    subscription.currency
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getBillingFrequency(
                    subscription.payment_frequency_interval,
                    subscription.payment_frequency_count
                  )}
                  {subscription.tax_inclusive
                    ? " (tax inclusive)"
                    : " (plus tax)"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Next Billing Date
                </h3>
                <p className="text-base">
                  {formatDate(subscription.next_billing_date)}
                </p>
              </div>
              {subscription.previous_billing_date && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Last Billing Date
                  </h3>
                  <p className="text-base">
                    {formatDate(subscription.previous_billing_date)}
                  </p>
                </div>
              )}
            </div>

            {subscription.cancelled_at && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">
                  <strong>Cancelled:</strong>{" "}
                  {formatDate(subscription.cancelled_at)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
                className="min-w-[140px] flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {isLoadingPortal ? "Loading..." : "Manage Subscription"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Name
                </h3>
                <p className="text-base">{subscription.customer.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Email
                </h3>
                <p className="text-base">{subscription.customer.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-base">{subscription.billing.street}</p>
              <p className="text-base">
                {subscription.billing.city}, {subscription.billing.state}{" "}
                {subscription.billing.zipcode}
              </p>
              <p className="text-base">{subscription.billing.country}</p>
            </div>
            {/* <Button variant="secondary" className="mt-4">
              Update Billing Address
            </Button> */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>View your past invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Subscription created on {formatDate(subscription.created_at)}
            </p>
            {/* Future: Add billing history table here */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillingSettingsPage;
