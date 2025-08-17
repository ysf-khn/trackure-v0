import { Suspense } from "react";
import { VendorDetailsPage } from "@/components/vendors/vendor-details-page";

interface VendorPageProps {
  params: Promise<{ vendorId: string }>;
}

export default async function VendorPage({ params }: VendorPageProps) {
  const { vendorId } = await params;

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<VendorDetailsSkeleton />}>
        <VendorDetailsPage vendorId={vendorId} />
      </Suspense>
    </div>
  );
}

function VendorDetailsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Navigation Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 bg-muted rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-16 bg-muted rounded animate-pulse" />
          <div className="h-9 w-10 bg-muted rounded animate-pulse" />
        </div>
      </div>
      
      {/* Vendor Header Skeleton */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-muted rounded-lg animate-pulse" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-48 bg-muted rounded animate-pulse" />
                <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
              </div>
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="space-y-1">
                  <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Quick Contact Bar Skeleton */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-32 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="space-y-6">
        <div className="flex gap-6 border-b">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}