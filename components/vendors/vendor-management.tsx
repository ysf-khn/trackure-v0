"use client";

import { useState } from "react";
import { Plus, Building, Phone, Mail, MapPin, FileText, DollarSign, CreditCard } from "lucide-react";
import { DateRange } from "react-day-picker";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVendors } from "@/hooks/queries/use-vendors";
import { AddVendorModal } from "./add-vendor-modal";
import { VendorSummaryFilters } from "./vendor-summary-filters";
import { useVendorPaymentSummary, DatePeriod } from "@/hooks/queries/use-vendor-payment-summary";

export function VendorManagement() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [period, setPeriod] = useState<DatePeriod>("last_30_days");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const router = useRouter();

  const { data: vendorsData, isLoading, error } = useVendors();
  const vendors = vendorsData?.vendors || [];
  const meta = vendorsData?.meta;

  // Get payment summary data
  const { data: paymentSummary, isLoading: isSummaryLoading, error: summaryError } = useVendorPaymentSummary({
    period,
    fromDate: dateRange?.from?.toISOString().split('T')[0],
    toDate: dateRange?.to?.toISOString().split('T')[0],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Filter skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-4 w-48" />
        </div>
        
        {/* Summary cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Vendors grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || summaryError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error ? `Failed to load vendors: ${error.message}` : `Failed to load payment summary: ${summaryError?.message}`}
        </AlertDescription>
      </Alert>
    );
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <VendorSummaryFilters
        period={period}
        onPeriodChange={setPeriod}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Enhanced summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Vendors
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta?.total_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentSummary?.vendors.withActivityInPeriod || 0} with activity in period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Vendors
            </CardTitle>
            <Building className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {meta?.active_count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Payments
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                formatCurrency(paymentSummary?.payments.total || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentSummary?.payments.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Outstanding
            </CardTitle>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                formatCurrency(paymentSummary?.outstanding.total || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentSummary?.outstanding.orderCount || 0} pending orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Vendor Button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Vendors grid */}
      {vendors.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No vendors yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first vendor to manage pricing for
              workflow stages.
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Vendor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <Card
              key={vendor.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/vendors/${vendor.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{vendor.name}</CardTitle>
                    {vendor.firm_name && (
                      <CardDescription>{vendor.firm_name}</CardDescription>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant={vendor.is_active ? "default" : "secondary"}
                      className="text-white"
                    >
                      {vendor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vendor.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{vendor.address}</span>
                    </div>
                  )}

                  {/* Vendor stats */}
                  <div className="pt-2 border-t border-border">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Pricing:</span>
                        <span className="ml-1 font-medium">
                          {vendor.stats?.active_pricing_count || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SKUs:</span>
                        <span className="ml-1 font-medium">
                          {vendor.stats?.supported_skus || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stages:</span>
                        <span className="ml-1 font-medium">
                          {vendor.stats?.supported_stages || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Lead:</span>
                        <span className="ml-1 font-medium">
                          {vendor.stats?.avg_lead_time
                            ? `${Math.round(vendor.stats.avg_lead_time)}d`
                            : "-"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Outstanding amount - show if there's an outstanding balance */}
                    {vendor.stats?.outstanding_amount > 0 && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Outstanding:</span>
                          <span className="text-sm font-medium text-amber-600">
                            {formatCurrency(vendor.stats.outstanding_amount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <AddVendorModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
    </div>
  );
}
