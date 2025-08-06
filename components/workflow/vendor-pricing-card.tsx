"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSignIcon, 
  ClockIcon, 
  PackageIcon, 
  BuildingIcon,
  AlertCircleIcon 
} from "lucide-react";
import { useStageVendorPricing, type StageVendorPricing } from "@/hooks/queries/use-stage-vendor-pricing";

interface VendorPricingCardProps {
  stageId: string;
  stageName?: string;
  itemCount?: number;
  totalQuantity?: number;
}

interface VendorPricingRowProps {
  vendor: StageVendorPricing;
  totalQuantity?: number;
}

function VendorPricingRow({ vendor, totalQuantity = 0 }: VendorPricingRowProps) {
  const estimatedCost = totalQuantity * (vendor?.price || 0);
  const meetsMinimum = totalQuantity >= (vendor?.minimum_quantity || 0);

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'INR': return '₹';
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return currency;
    }
  };

  const formatPriceUnit = (unit: string) => {
    switch (unit) {
      case 'per_piece': return 'per piece';
      case 'per_kg': return 'per kg';
      case 'per_dozen': return 'per dozen';
      case 'per_hundred': return 'per 100';
      default: return unit;
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <BuildingIcon className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">{vendor?.vendor?.name || "Unknown Vendor"}</h4>
            {vendor?.vendor?.firm_name && (
              <span className="text-sm text-muted-foreground">
                ({vendor.vendor.firm_name})
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-1">
              <DollarSignIcon className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">
                {getCurrencySymbol(vendor?.currency || 'USD')}{vendor?.price || 0}
              </span>
              <span className="text-muted-foreground">
                {formatPriceUnit(vendor?.price_unit || 'per_piece')}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <ClockIcon className="h-3 w-3 text-muted-foreground" />
              <span>{vendor?.lead_time_days || 0} days</span>
            </div>
            
            <div className="flex items-center gap-1">
              <PackageIcon className="h-3 w-3 text-muted-foreground" />
              <span>Min: {vendor?.minimum_quantity || 0}</span>
            </div>

            {totalQuantity > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-primary">
                  Est: {getCurrencySymbol(vendor?.currency || 'USD')}{estimatedCost.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {!meetsMinimum && totalQuantity > 0 && (
            <div className="flex items-center gap-1 mt-2 text-amber-600">
              <AlertCircleIcon className="h-3 w-3" />
              <span className="text-xs">
                Below minimum quantity ({vendor?.minimum_quantity || 0})
              </span>
            </div>
          )}

          {vendor?.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {vendor?.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function VendorPricingCard({ 
  stageId, 
  stageName, 
  itemCount = 0, 
  totalQuantity = 0 
}: VendorPricingCardProps) {
  const { data, isLoading, error } = useStageVendorPricing(stageId);
  
  // Don't render if stageId is not provided
  if (!stageId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Vendor Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Vendor Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>
              Failed to load vendor pricing: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const vendors = data?.vendorPricing || [];

  if (vendors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Vendor Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <DollarSignIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vendor pricing configured for this stage</p>
            <p className="text-xs">Configure pricing in workflow settings</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total estimated cost across all vendors (for comparison)
  const totalEstimatedCost = vendors.reduce((sum, vendor) => {
    return sum + (totalQuantity * (vendor?.price || 0));
  }, 0);

  const lowestCostVendor = vendors.reduce((lowest, current) => {
    return (current?.price || 0) < (lowest?.price || 0) ? current : lowest;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5" />
            Vendor Pricing
            <Badge variant="outline" className="ml-2">
              {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          
          {totalQuantity > 0 && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {totalQuantity} items in stage
              </p>
              {vendors.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Lowest: {lowestCostVendor?.vendor?.name || 'Unknown'}
                </p>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {vendors.map((vendor) => (
          <VendorPricingRow 
            key={vendor.id} 
            vendor={vendor} 
            totalQuantity={totalQuantity} 
          />
        ))}
        
        {vendors.length > 1 && totalQuantity > 0 && (
          <div className="border-t pt-3 mt-4">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Cost Range:</span>
              <span className="font-medium">
                {vendors[0]?.currency === vendors[1]?.currency ? (
                  `${vendors[0]?.currency === 'INR' ? '₹' : vendors[0]?.currency}${Math.min(...vendors.map(v => (v?.price || 0) * totalQuantity)).toLocaleString()} - ${vendors[0]?.currency === 'INR' ? '₹' : vendors[0]?.currency}${Math.max(...vendors.map(v => (v?.price || 0) * totalQuantity)).toLocaleString()}`
                ) : (
                  'Mixed currencies'
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}