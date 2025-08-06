"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit,
  Trash2,
  Plus,
  History,
  Package,
  DollarSign,
  ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorPriceHistory } from "./vendor-price-history";
import { VendorOrdersPanel } from "./vendor-orders-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VendorDetailsPageProps {
  vendorId: string;
}

export function VendorDetailsPage({ vendorId }: VendorDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<
    "details" | "pricing" | "orders" | "history"
  >("details");

  const {
    data: vendor,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => {
      const response = await fetch(`/api/vendors/${vendorId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor details");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <Skeleton className="h-12 w-full" />
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/vendors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Vendors
            </Link>
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load vendor details: {(error as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const vendorData = vendor?.vendor;
  if (!vendorData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendors">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Vendors
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{vendorData.name}</h1>
            <Badge variant={vendorData.is_active ? "default" : "secondary"}>
              {vendorData.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {vendorData.firm_name && (
            <p className="text-lg text-muted-foreground">{vendorData.firm_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit Vendor
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">
            <Building className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <FileText className="h-4 w-4 mr-2" />
            Pricing ({vendorData.pricing?.filter((p) => p.is_active).length || 0})
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Package className="h-4 w-4 mr-2" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Price History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="details" className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vendorData.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">
                          {vendorData.phone}
                        </p>
                      </div>
                    </div>
                  )}
                  {vendorData.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">
                          {vendorData.email}
                        </p>
                      </div>
                    </div>
                  )}
                  {vendorData.gst && (
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">GST Number</p>
                        <p className="text-sm text-muted-foreground">
                          {vendorData.gst}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {vendorData.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {vendorData.address}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Information */}
            {vendorData.remarks && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Remarks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {vendorData.remarks}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {vendorData.stats?.active_pricing_count || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Active Pricing
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {vendorData.stats?.supported_skus || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supported SKUs
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {vendorData.stats?.supported_stages || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Workflow Stages
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {vendorData.stats?.avg_lead_time
                        ? `${Math.round(vendorData.stats.avg_lead_time)}d`
                        : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg Lead Time
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Stage Pricing</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pricing
                </Button>
              </div>

              {vendorData.pricing && vendorData.pricing.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stage / Path</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Min Qty</TableHead>
                          <TableHead>Lead Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorData.pricing.map((pricing) => (
                          <TableRow key={pricing.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {pricing.stage?.name || "Unknown Stage"}
                                </p>
                                {pricing.stage?.full_path && (
                                  <p className="text-xs text-muted-foreground">
                                    {pricing.stage.full_path}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {pricing.sku}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {pricing.currency} {pricing.price}
                              </span>
                            </TableCell>
                            <TableCell>{pricing.price_unit}</TableCell>
                            <TableCell>{pricing.minimum_quantity}</TableCell>
                            <TableCell>{pricing.lead_time_days} days</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  pricing.is_active ? "default" : "secondary"
                                }
                              >
                                {pricing.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No pricing configured
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Set up pricing for this vendor to use them in your
                      workflows.
                    </p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Pricing
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <VendorOrdersPanel vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="history">
            <VendorPriceHistory vendorId={vendorId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}