"use client";

import {
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OrderStatsProps {
  stats: {
    totalItems: number;
    completedItems: number;
    inProgressItems: number;
    newItems: number;
    reworkItems?: number;
  };
}

export function OrderStats({ stats }: OrderStatsProps) {
  const completionPercentage =
    stats.totalItems > 0
      ? Math.round((stats.completedItems / stats.totalItems) * 100)
      : 0;

  const statCards = [
    {
      label: "Total Items",
      value: stats.totalItems,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Completed",
      value: stats.completedItems,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-primary/10",
    },
    {
      label: "In Progress",
      value: stats.inProgressItems,
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-primary/10",
    },
    {
      label: "New Items",
      value: stats.newItems,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-primary/10",
    },
  ];

  // Add rework card only if there are rework items
  if (stats.reworkItems && stats.reworkItems > 0) {
    statCards.push({
      label: "Rework",
      value: stats.reworkItems,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    });
  }

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">Order Progress</h3>
            <span className="text-2xl font-bold text-primary">
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-primary/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {stats.completedItems} of {stats.totalItems} items completed
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded ${stat.bgColor}`}>
                    <Icon className={`h-3 w-3 ${stat.color}`} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {stat.label}
                  </span>
                </div>
                <div className={`text-xl font-bold ${stat.color}`}>
                  {stat.value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
