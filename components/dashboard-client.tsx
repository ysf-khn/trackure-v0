"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Dynamic imports for heavy components with loading states
const ChartBarInteractive = dynamic(
  () =>
    import("@/components/chart-bar-interactive").then((mod) => ({
      default: mod.ChartBarInteractive,
    })),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    ),
    ssr: false, // Chart component doesn't need SSR
  }
);

const BottleneckItemsTable = dynamic(
  () =>
    import("@/components/bottleneck-items-table").then((mod) => ({
      default: mod.BottleneckItemsTable,
    })),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ),
  }
);

export function DashboardClient() {
  return (
    <>
      {/* Heavy components - lazy load these */}
      <div className="px-4 lg:px-6">
        <ChartBarInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <BottleneckItemsTable limit={10} />
      </div>
    </>
  );
}
