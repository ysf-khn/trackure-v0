"use client";

import { useState } from "react";
import { Plus, Building, Phone, Mail, MapPin, FileText } from "lucide-react";
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

export function VendorManagement() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const router = useRouter();

  const { data: vendorsData, isLoading, error } = useVendors();
  const vendors = vendorsData?.vendors || [];
  const meta = vendorsData?.meta;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load vendors: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex justify-between items-start">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3 w-full max-w-4xl">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Vendors
              </CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{meta?.total_count || 0}</div>
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Inactive Vendors
              </CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {meta?.inactive_count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
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
