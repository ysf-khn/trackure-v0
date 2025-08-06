import { Skeleton } from "@/components/ui/skeleton";

export default function VendorDetailsLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" /> {/* Back button */}
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-48" /> {/* Vendor name */}
            <Skeleton className="h-6 w-16" /> {/* Active badge */}
          </div>
          <Skeleton className="h-6 w-40" /> {/* Firm name */}
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" /> {/* Edit button */}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        {/* Tab navigation */}
        <div className="grid w-full grid-cols-4 gap-1 bg-muted p-1 rounded-lg">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Tab content area */}
        <div className="space-y-6">
          {/* Contact Information Card */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-40" /> {/* Card title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 mt-0.5" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Remarks Card */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-20" /> {/* Card title */}
              <Skeleton className="h-16 w-full" /> {/* Remarks content */}
            </div>
          </div>

          {/* Statistics Card */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-24" /> {/* Card title */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-12 mx-auto" /> {/* Number */}
                  <Skeleton className="h-4 w-20 mx-auto" /> {/* Label */}
                </div>
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-8 mx-auto" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-8 mx-auto" />
                  <Skeleton className="h-4 w-28 mx-auto" />
                </div>
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-12 mx-auto" />
                  <Skeleton className="h-4 w-20 mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}