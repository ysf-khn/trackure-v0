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
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-muted rounded animate-pulse" />
      </div>
      
      <div className="h-12 w-full bg-muted rounded animate-pulse" />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}