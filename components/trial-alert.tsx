"use client";

import React, { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, Clock, AlertTriangle, Crown } from "lucide-react";
import useSubscription from "@/hooks/queries/use-subscription";

interface TrialAlertProps {
  className?: string;
}

export default function TrialAlert({ className }: TrialAlertProps) {
  const { subscription, isLoading } = useSubscription();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set()
  );

  // Load dismissed alerts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("dismissedTrialAlerts");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDismissedAlerts(new Set(parsed));
      } catch (error) {
        console.error("Error parsing dismissed alerts:", error);
      }
    }
  }, []);

  // Calculate remaining trial days
  const calculateRemainingTrialDays = () => {
    if (!subscription || subscription.trial_period_days <= 0) return 0;

    const createdDate = new Date(subscription.created_at);
    const currentDate = new Date();
    const daysPassed = Math.floor(
      (currentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const remainingDays = subscription.trial_period_days - daysPassed;

    return Math.max(0, remainingDays);
  };

  const remainingTrialDays = calculateRemainingTrialDays();

  // Determine if we should show an alert and what type
  const getAlertConfig = () => {
    if (remainingTrialDays <= 0) return null;

    // Last 3 days - show every day
    if (remainingTrialDays <= 3) {
      return {
        key: `trial-${remainingTrialDays}`,
        variant: "destructive" as const,
        icon: AlertTriangle,
        title: `Your free trial expires ${remainingTrialDays === 1 ? "today" : `in ${remainingTrialDays} ${remainingTrialDays === 1 ? "day" : "days"}`}!`,
        description: `Your trial period ends ${remainingTrialDays === 1 ? "today" : `in ${remainingTrialDays} ${remainingTrialDays === 1 ? "day" : "days"}`}. No action is required unless you wish to cancel.`,
        urgent: true,
      };
    }

    // 7 days left
    if (remainingTrialDays === 7) {
      return {
        key: "trial-7",
        variant: "default" as const,
        icon: Clock,
        title: "7 days left in your trial",
        description:
          "You’re all set - no action needed. Your subscription will begin automatically when the trial ends.",
        urgent: false,
      };
    }

    // 13 days left (1 day after trial starts for 14-day trial)
    if (remainingTrialDays === 13) {
      return {
        key: "trial-13",
        variant: "default" as const,
        icon: Crown,
        title: "Welcome to Trakure!",
        description:
          "You’re on a 14-day free trial. You’ve already subscribed, the plan will start automatically when the trial ends.",
        urgent: false,
      };
    }

    return null;
  };

  const alertConfig = getAlertConfig();

  // Don't show if loading, no subscription, no alert needed, or alert was dismissed
  if (
    isLoading ||
    !subscription ||
    !alertConfig ||
    dismissedAlerts.has(alertConfig.key)
  ) {
    return null;
  }

  const handleDismiss = () => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.add(alertConfig.key);
    setDismissedAlerts(newDismissed);

    // Save to localStorage
    localStorage.setItem(
      "dismissedTrialAlerts",
      JSON.stringify(Array.from(newDismissed))
    );
  };

  const AlertIcon = alertConfig.icon;

  return (
    <div className={`w-full bg-black ${className}`}>
      <Alert
        variant={alertConfig.variant}
        className={`rounded-none border-x-0 ${
          alertConfig.urgent
            ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
            : alertConfig.variant === "default"
              ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
              : ""
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <AlertIcon
              className={`h-4 w-4 ${
                alertConfig.urgent
                  ? "text-red-600 dark:text-red-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  alertConfig.urgent
                    ? "text-red-900 dark:text-red-100"
                    : "text-blue-900 dark:text-blue-100"
                }`}
              >
                {alertConfig.title}
              </div>
              <AlertDescription
                className={`${
                  alertConfig.urgent
                    ? "text-red-700 dark:text-red-300"
                    : "text-blue-700 dark:text-blue-300"
                }`}
              >
                {alertConfig.description}
              </AlertDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className={`${
                alertConfig.urgent
                  ? "hover:bg-red-100 dark:hover:bg-red-900/20"
                  : "hover:bg-blue-100 dark:hover:bg-blue-900/20"
              }`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
