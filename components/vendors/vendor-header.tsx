"use client";

import {
  Building,
  Package,
  Clock,
  FileText,
  Phone,
  Mail,
  MapPin,
  Copy,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface VendorHeaderProps {
  vendor: {
    name: string;
    firm_name?: string;
    is_active: boolean;
    phone?: string;
    email?: string;
    gst?: string;
    address?: string;
    remarks?: string;
    stats?: {
      active_pricing_count?: number;
      supported_skus?: number;
      supported_stages?: number;
      avg_lead_time?: number;
    };
    metrics?: {
      total_payment_till_date?: number;
      outstanding_payment?: number;
      active_skus?: number;
      total_assigned_skus?: number;
      active_pricing_entries?: number;
      supported_skus?: number;
      supported_stages?: number;
      price_range?: {
        avg?: number;
      };
    };
  };
}

export function VendorHeader({ vendor }: VendorHeaderProps) {
  console.log('VendorHeader - Received vendor prop:', vendor);
  console.log('VendorHeader - vendor.metrics:', vendor.metrics);
  console.log('VendorHeader - outstanding_payment:', vendor.metrics?.outstanding_payment);
  console.log('VendorHeader - total_payment_till_date:', vendor.metrics?.total_payment_till_date);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Use new metrics for header stats
  const stats = [
    {
      label: "Total Payment",
      value: vendor.metrics?.total_payment_till_date 
        ? formatCurrency(vendor.metrics.total_payment_till_date)
        : formatCurrency(0),
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      label: "Outstanding",
      value: vendor.metrics?.outstanding_payment 
        ? formatCurrency(vendor.metrics.outstanding_payment)
        : formatCurrency(0),
      icon: AlertCircle,
      color: vendor.metrics?.outstanding_payment && vendor.metrics.outstanding_payment > 0 
        ? "text-red-600" 
        : "text-gray-600",
    },
    {
      label: "Active SKUs",
      value: vendor.metrics?.active_skus ?? 0,
      icon: Package,
      color: "text-blue-600",
    },
    {
      label: "Total SKUs",
      value: vendor.metrics?.total_assigned_skus ?? 0,
      icon: FileText,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="border rounded-xl p-6 shadow-sm">
      <div className="flex gap-8">
        {/* Left section: Vendor identity */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-lg flex items-center justify-center text-white font-semibold text-xl",
              vendor.is_active ? "bg-green-600" : "bg-gray-400"
            )}
          >
            {getInitials(vendor.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{vendor.name}</h1>
              <Badge
                variant={vendor.is_active ? "default" : "secondary"}
                className={cn(
                  "ml-2",
                  vendor.is_active
                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                    : "bg-gray-100 text-gray-600"
                )}
              >
                {vendor.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {vendor.firm_name && (
              <p className="text-muted-foreground mt-1">{vendor.firm_name}</p>
            )}
          </div>
        </div>

        {/* Right section: Contact details */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {vendor.gst && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono">GSTIN: {vendor.gst}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(vendor.gst!, "GST")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {vendor.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{vendor.phone}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(vendor.phone!, "Phone")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{vendor.email}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(vendor.email!, "Email")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}

          {vendor.address && (
            <div className="flex items-start gap-2 col-span-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm line-clamp-2">{vendor.address}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(vendor.address!, "Address")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="border rounded-xl p-4 transition-all duration-200 "
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-5 w-5", stat.color)} />
                <div>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
