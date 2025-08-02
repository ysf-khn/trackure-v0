"use client";

import { useState } from "react";
import { Building, Phone, Mail, MapPin, FileText, Edit, Trash2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VendorDetailsModalProps {
  vendorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorDetailsModal({
  vendorId,
  open,
  onOpenChange,
}: VendorDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "pricing">("details");

  const { data: vendor, isLoading, error } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => {
      const response = await fetch(`/api/vendors/${vendorId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor details");
      }
      return response.json();
    },
    enabled: open && !!vendorId,
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load vendor details: {error.message}
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  const vendorData = vendor?.vendor;
  if (!vendorData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{vendorData.name}</DialogTitle>
              <DialogDescription>
                {vendorData.firm_name && `${vendorData.firm_name} • `}
                Vendor Details and Pricing
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={vendorData.is_active ? "default" : "secondary"}>
                {vendorData.is_active ? "Active" : "Inactive"}
              </Badge>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === "details" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("details")}
            className="flex-1"
          >
            Vendor Details
          </Button>
          <Button
            variant={activeTab === "pricing" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("pricing")}
            className="flex-1"
          >
            Pricing ({vendorData.pricing?.filter(p => p.is_active).length || 0})
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vendorData.contact_person && (
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Contact Person</p>
                        <p className="text-sm text-muted-foreground">{vendorData.contact_person}</p>
                      </div>
                    </div>
                  )}
                  {vendorData.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{vendorData.phone}</p>
                      </div>
                    </div>
                  )}
                  {vendorData.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{vendorData.email}</p>
                      </div>
                    </div>
                  )}
                  {vendorData.gst && (
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">GST Number</p>
                        <p className="text-sm text-muted-foreground">{vendorData.gst}</p>
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
                    <p className="text-2xl font-bold">{vendorData.stats?.active_pricing_count || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Pricing</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{vendorData.stats?.supported_skus || 0}</p>
                    <p className="text-sm text-muted-foreground">Supported SKUs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{vendorData.stats?.supported_stages || 0}</p>
                    <p className="text-sm text-muted-foreground">Workflow Stages</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {vendorData.stats?.avg_lead_time ? `${Math.round(vendorData.stats.avg_lead_time)}d` : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Lead Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "pricing" && (
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
                              <p className="font-medium">{pricing.stage?.name || "Unknown Stage"}</p>
                              {pricing.stage?.full_path && (
                                <p className="text-xs text-muted-foreground">
                                  {pricing.stage.full_path}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{pricing.sku}</TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {pricing.currency} {pricing.price}
                            </span>
                          </TableCell>
                          <TableCell>{pricing.price_unit}</TableCell>
                          <TableCell>{pricing.minimum_quantity}</TableCell>
                          <TableCell>{pricing.lead_time_days} days</TableCell>
                          <TableCell>
                            <Badge variant={pricing.is_active ? "default" : "secondary"}>
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
                  <h3 className="text-lg font-medium mb-2">No pricing configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Set up pricing for this vendor to use them in your workflows.
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pricing
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}