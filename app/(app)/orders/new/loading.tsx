import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function NewOrderLoading() {
  return (
    <div className="container mx-auto space-y-8">
      {/* Page header skeleton */}
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <Skeleton className="h-6 w-48" />
        </div>
      </div>

      <div className="px-4 md:px-6">
        <Card className="w-full max-w-3xl mx-auto mb-4">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full mt-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Order Number field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Customer Name field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Total Quantity field */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-3 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Packaging Reminders section */}
            <div className="space-y-4">
              <div className="border rounded-lg p-6 bg-muted/50">
                <div className="flex items-center space-x-2 mb-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-4 w-4/5 mb-4" />

                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="w-2 h-2 rounded-full" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
