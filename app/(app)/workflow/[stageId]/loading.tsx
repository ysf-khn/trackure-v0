import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function WorkflowStageLoading() {
  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-4">
      {/* Breadcrumbs skeleton */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/workflow">Workflow</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Skeleton className="h-5 w-32" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Stage info card skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-48" /> {/* Stage name */}
              <Skeleton className="h-5 w-32" /> {/* Full path */}
            </div>
            <Skeleton className="h-6 w-32" /> {/* Sequence order badge */}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" /> {/* Location icon */}
            <Skeleton className="h-4 w-24" /> {/* Location text */}
          </div>
        </CardContent>
      </Card>

      {/* Items table skeleton */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Table header with actions */}
          <div className="flex justify-between items-center">
            <Skeleton className="h-7 w-48" /> {/* Table title */}
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" /> {/* Filter button */}
              <Skeleton className="h-9 w-32" /> {/* Add item button */}
            </div>
          </div>

          {/* Table skeleton */}
          <div className="rounded-md border">
            {/* Table header */}
            <div className="border-b bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-16" /> {/* Order # */}
                  <Skeleton className="h-4 w-20" /> {/* SKU */}
                  <Skeleton className="h-4 w-24" /> {/* Customer */}
                  <Skeleton className="h-4 w-20" /> {/* Quantity */}
                  <Skeleton className="h-4 w-24" /> {/* Progress */}
                  <Skeleton className="h-4 w-20" /> {/* Actions */}
                </div>
              </div>
            </div>

            {/* Table rows */}
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8" /> {/* Action button */}
                      <Skeleton className="h-8 w-8" /> {/* Action button */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" /> {/* Results count */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" /> {/* Previous button */}
              <Skeleton className="h-8 w-8" /> {/* Page number */}
              <Skeleton className="h-8 w-24" /> {/* Next button */}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}