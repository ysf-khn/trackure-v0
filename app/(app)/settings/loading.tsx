import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SettingsIcon } from "lucide-react";

export default function SettingsLoading() {
  return (
    <div className="container mx-auto space-y-8">
      {/* Header Section */}
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-8">
        {/* Workflow Management Section */}
        <section id="workflow-settings">
          <h2 className="text-2xl font-semibold mb-4">Workflow Management</h2>

          {/* Workflow Rules Alert Skeleton */}
          <div className="mb-4 p-4 border rounded-md">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>

          {/* WorkflowEditor Card Skeleton */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-8 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stage Skeletons */}
              {[1, 2, 3].map((index) => (
                <div key={index} className="rounded-md border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>

                  {/* Sub-stages skeleton */}
                  <div className="ml-6 mt-3 space-y-2 border-l pl-4">
                    {[1, 2].map((subIndex) => (
                      <div
                        key={subIndex}
                        className="flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <Skeleton className="h-4 w-2/3 mb-1" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <div className="flex gap-1">
                          <Skeleton className="h-6 w-6" />
                          <Skeleton className="h-6 w-6" />
                          <Skeleton className="h-6 w-6" />
                          <Skeleton className="h-6 w-6" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
