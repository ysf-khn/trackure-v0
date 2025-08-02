"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, MapPin, Building, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VendorPricing {
  vendor_id: string;
  vendor_name: string;
  vendor_location?: string;
  pricing_per_unit: number;
  currency: string;
  stage_name: string;
  sub_stage_name?: string;
  full_path: string;
  sku: string;
  last_updated: string;
  notes?: string;
}

interface VendorPricingPanelProps {
  stageId: string;
  subStageId?: string | null;
  organizationId: string;
}

export function VendorPricingPanel({
  stageId,
  subStageId,
  organizationId,
}: VendorPricingPanelProps) {
  const { data: vendorPricing, isLoading, error } = useQuery<VendorPricing[]>({
    queryKey: ["vendor-pricing", stageId, subStageId, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        stage_id: stageId,
        organization_id: organizationId,
      });
      
      if (subStageId) {
        params.append("sub_stage_id", subStageId);
      }

      const response = await fetch(`/api/vendor-pricing?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor pricing");
      }
      return response.json();
    },
    enabled: !!stageId && !!organizationId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vendor Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vendor Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load vendor pricing: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!vendorPricing || vendorPricing.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vendor Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No vendor pricing found</h3>
            <p className="text-muted-foreground mb-4">
              No vendors have provided pricing for this stage yet.
            </p>
            <Button variant="outline" size="sm">
              <DollarSign className="h-4 w-4 mr-2" />
              Add Vendor Pricing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group pricing by SKU
  const pricingBySKU = vendorPricing.reduce((acc, pricing) => {
    if (!acc[pricing.sku]) {
      acc[pricing.sku] = [];
    }
    acc[pricing.sku].push(pricing);
    return acc;
  }, {} as Record<string, VendorPricing[]>);

  // Sort vendors within each SKU by price (lowest first)
  Object.keys(pricingBySKU).forEach(sku => {
    pricingBySKU[sku].sort((a, b) => a.pricing_per_unit - b.pricing_per_unit);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Vendor Pricing
          <Badge variant="outline" className="ml-auto">
            {vendorPricing.length} vendor{vendorPricing.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(pricingBySKU).map(([sku, skuPricing]) => (
            <div key={sku} className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">{sku}</h4>
                <Badge variant="secondary" className="text-xs">
                  {skuPricing.length} vendor{skuPricing.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Price per Unit</TableHead>
                      <TableHead>Path Context</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skuPricing.map((pricing, index) => (
                      <TableRow key={`${pricing.vendor_id}-${pricing.sku}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{pricing.vendor_name}</span>
                            {index === 0 && (
                              <Badge variant="default" className="text-xs">
                                Best Price
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono">
                              {pricing.currency} {pricing.pricing_per_unit.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{pricing.stage_name}</div>
                            {pricing.sub_stage_name && (
                              <div className="text-muted-foreground text-xs">
                                → {pricing.sub_stage_name}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {pricing.full_path}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pricing.vendor_location ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {pricing.vendor_location}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(pricing.last_updated).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {skuPricing[0].notes && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  <strong>Note:</strong> {skuPricing[0].notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <Button variant="outline" size="sm" className="w-full">
            <DollarSign className="h-4 w-4 mr-2" />
            Manage Vendor Pricing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}