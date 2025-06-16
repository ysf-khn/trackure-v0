"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLimitCheck } from "@/hooks/queries/use-plan-limits";
import { getPlanTitleByProductId } from "@/lib/plans";
import {
  Users,
  Package,
  ShoppingCart,
  ArrowUpCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import useSubscription from "@/hooks/queries/use-subscription";

export function PlanUsageSection() {
  const {
    limits,
    isLoading: limitsLoading,
    error: limitsError,
  } = useLimitCheck();
  const { subscription, isLoading: subscriptionLoading } = useSubscription();

  if (limitsLoading || subscriptionLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Usage</CardTitle>
          <CardDescription>Your current plan usage and limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (limitsError || !limits) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Usage</CardTitle>
          <CardDescription>Your current plan usage and limits</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load plan usage data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const planTitle = subscription
    ? getPlanTitleByProductId(subscription.product_id)
    : "No Plan";
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Plan Usage</CardTitle>
            <CardDescription>
              Current plan: <Badge variant="outline">{planTitle}</Badge>
            </CardDescription>
          </div>
          <Link href="/pricing">
            <Button variant="outline" size="sm">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Team Members</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {limits.usage.currentUsers} / {limits.limits.maxUsers}
              </div>
            </div>
            <Progress value={userUsagePercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{userUsagePercent}% used</span>
              {userUsagePercent >= 80 && (
                <span className="text-orange-600">Near limit</span>
              )}
              {limits.violations.users && (
                <span className="text-red-600">Limit exceeded</span>
              )}
            </div>
          </div>

          {/* Active Orders */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Active Orders</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {limits.usage.currentActiveOrders} /{" "}
                {limits.limits.maxActiveOrdersPerMonth}
              </div>
            </div>
            <Progress value={orderUsagePercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{orderUsagePercent}% used this month</span>
              {orderUsagePercent >= 80 && (
                <span className="text-orange-600">Near limit</span>
              )}
              {limits.violations.orders && (
                <span className="text-red-600">Limit exceeded</span>
              )}
            </div>
          </div>

          {/* Active Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Active Items</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {limits.usage.currentActiveItems} /{" "}
                {limits.limits.maxActiveItemsPerMonth}
              </div>
            </div>
            <Progress value={itemUsagePercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{itemUsagePercent}% used this month</span>
              {itemUsagePercent >= 80 && (
                <span className="text-orange-600">Near limit</span>
              )}
              {limits.violations.items && (
                <span className="text-red-600">Limit exceeded</span>
              )}
            </div>
          </div>
        </div>

        {(limits.violations.users ||
          limits.violations.orders ||
          limits.violations.items) && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">
              Plan Limits Exceeded
            </h4>
            <p className="text-sm text-red-700 mb-3">
              You've exceeded your plan limits. Some features may be restricted
              until you upgrade or reduce usage.
            </p>
            <Link href="/pricing">
              <Button size="sm" variant="destructive">
                Upgrade Now
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
