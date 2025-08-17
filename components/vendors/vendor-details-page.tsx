"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Edit,
  Trash2,
  Package,
  ArrowLeft,
  MoreVertical,
  Copy,
  ExternalLink,
  Clock,
  CreditCard,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorOrdersPanel } from "./vendor-orders-panel";
import { VendorHeader } from "./vendor-header";
import { VendorActiveAssignments } from "./vendor-active-assignments";
import { VendorPaymentHistory } from "./vendor-payment-history";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VendorDetailsPageProps {
  vendorId: string;
}

export function VendorDetailsPage({ vendorId }: VendorDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<
    "orders" | "active-assignments" | "payment-history"
  >("orders");

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
        {/* Top Navigation Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-9 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-10" />
          </div>
        </div>

        {/* Vendor Header Skeleton */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/60 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <Skeleton className="w-16 h-16 rounded-lg" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-6 w-8" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Contact Bar Skeleton */}
        <div className="bg-gradient-to-r from-white to-gray-50/30 border border-gray-200/60 rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-32 rounded-md" />
            ))}
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="space-y-6">
          <div className="flex gap-6 border-b">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-20" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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

  console.log('VendorDetailsPage - Full vendor response:', vendor);
  console.log('VendorDetailsPage - vendorData:', vendorData);
  console.log('VendorDetailsPage - vendor.metrics:', vendor.metrics);

  return (
    <div className="space-y-6 min-h-screen  -m-6 p-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vendors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Vendor
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="h-4 w-4 mr-2" />
                Export Data
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Vendor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Vendor Header with Stats and Contact Info */}
      <VendorHeader vendor={vendorData} />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
      >
        <TabsList className="w-full justify-start border bg-background  h-auto p-1 rounded-lg mb-2">
          <TabsTrigger
            value="orders"
            className=" data-[state=active]:border  rounded-md px-4 py-2.5 transition-all duration-200"
          >
            <Package className="h-4 w-4 mr-2" />
            Orders
          </TabsTrigger>
          <TabsTrigger
            value="active-assignments"
            className=" data-[state=active]:border  rounded-md px-4 py-2.5 transition-all duration-200"
          >
            <Clock className="h-4 w-4 mr-2" />
            Active Assignments
          </TabsTrigger>
          <TabsTrigger
            value="payment-history"
            className=" data-[state=active]:border  rounded-md px-4 py-2.5 transition-all duration-200"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Payment History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="orders">
            <VendorOrdersPanel vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="active-assignments">
            <VendorActiveAssignments vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="payment-history">
            <VendorPaymentHistory vendorId={vendorId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
