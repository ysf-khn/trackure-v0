"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLimitCheck } from "@/hooks/queries/use-plan-limits";
import {
  AlertTriangle,
  Users,
  Package,
  ShoppingCart,
  ArrowUpCircle,
} from "lucide-react";
import Link from "next/link";

interface PlanLimitsAlertProps {
  variant?: "inline" | "card";
  showTitle?: boolean;
}

export function PlanLimitsAlert({
  variant = "inline",
  showTitle = true,
}: PlanLimitsAlertProps) {
  const {
    limits,
    isLoading,
    error,
    isNearUserLimit,
    isNearOrderLimit,
    isNearItemLimit,
  } = useLimitCheck();

  if (isLoading || error || !limits) {
    return null;
  }

  const hasWarnings = isNearUserLimit || isNearOrderLimit || isNearItemLimit;
  const hasViolations =
    limits.violations.users ||
    limits.violations.orders ||
    limits.violations.items;

  if (!hasWarnings && !hasViolations) {
    return null;
  }

  const userUsagePercent = Math.round(
    (limits.usage.currentUsers / limits.limits.maxUsers) * 100
  );
  const orderUsagePercent = Math.round(
    (limits.usage.currentActiveOrders / limits.limits.maxActiveOrdersPerMonth) *
      100
  );
  const itemUsagePercent = Math.round(
    (limits.usage.currentActiveItems / limits.limits.maxActiveItemsPerMonth) *
      100
  );

  const getAlertType = () => {
    if (hasViolations) return "destructive";
    if (hasWarnings) return "default";
    return "default";
  };

  const content = (
    <>
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="font-semibold">
            {hasViolations ? "Plan Limits Exceeded" : "Approaching Plan Limits"}
          </h3>
        </div>
      )}

      <div className="space-y-4">
        {/* Users */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Users</span>
            {limits.violations.users && (
              <Badge variant="destructive">Exceeded</Badge>
            )}
            {isNearUserLimit && !limits.violations.users && (
              <Badge variant="secondary">Near Limit</Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {limits.usage.currentUsers} / {limits.limits.maxUsers}
            </div>
            <Progress value={userUsagePercent} className="w-20 h-2" />
          </div>
        </div>

        {/* Active Orders */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-medium">Active Orders</span>
            {limits.violations.orders && (
              <Badge variant="destructive">Exceeded</Badge>
            )}
            {isNearOrderLimit && !limits.violations.orders && (
              <Badge variant="secondary">Near Limit</Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {limits.usage.currentActiveOrders} /{" "}
              {limits.limits.maxActiveOrdersPerMonth}
            </div>
            <Progress value={orderUsagePercent} className="w-20 h-2" />
          </div>
        </div>

        {/* Active Items */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="text-sm font-medium">Active Items</span>
            {limits.violations.items && (
              <Badge variant="destructive">Exceeded</Badge>
            )}
            {isNearItemLimit && !limits.violations.items && (
              <Badge variant="secondary">Near Limit</Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {limits.usage.currentActiveItems} /{" "}
              {limits.limits.maxActiveItemsPerMonth}
            </div>
            <Progress value={itemUsagePercent} className="w-20 h-2" />
          </div>
        </div>

        {/* Upgrade CTA */}
        <div className="pt-2 border-t">
          <Link href="/pricing">
            <Button size="sm" className="w-full">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>
    </>
  );

  if (variant === "card") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {hasViolations ? "Plan Limits Exceeded" : "Plan Usage"}
          </CardTitle>
          <CardDescription>
            {hasViolations
              ? "You've exceeded your plan limits. Please upgrade to continue using all features."
              : "Monitor your current plan usage and limits."}
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return (
    <Alert variant={getAlertType()}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {hasViolations ? "Plan Limits Exceeded" : "Approaching Plan Limits"}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2">{content}</div>
      </AlertDescription>
    </Alert>
  );
}
