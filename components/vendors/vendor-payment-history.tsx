"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Receipt,
  Search,
  Filter,
  Download,
  User,
  Package,
  Calendar,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useVendorPayments } from "@/hooks/queries/use-vendor-payments";
import { usePaymentReceipts } from "@/hooks/queries/use-payment-receipts";

interface VendorPaymentHistoryProps {
  vendorId: string;
}

export function VendorPaymentHistory({ vendorId }: VendorPaymentHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("");
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());

  const {
    data: paymentsData,
    isLoading,
    error,
  } = useVendorPayments(vendorId, {
    paymentType: paymentTypeFilter && paymentTypeFilter !== "all" ? paymentTypeFilter : undefined,
    includeCarriedForward: true,
  });

  const toggleExpanded = (paymentId: string) => {
    const newExpanded = new Set(expandedPayments);
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId);
    } else {
      newExpanded.add(paymentId);
    }
    setExpandedPayments(newExpanded);
  };

  const getPaymentTypeVariant = (type: string) => {
    switch (type) {
      case "advance":
        return "secondary";
      case "part_payment":
        return "outline";
      case "closure":
        return "default";
      case "force_closure":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case "advance":
        return "text-blue-600";
      case "part_payment":
        return "text-yellow-600";
      case "closure":
        return "text-green-600";
      case "force_closure":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPaymentType = (type: string) => {
    switch (type) {
      case "advance":
        return "Advance";
      case "part_payment":
        return "Part Payment";
      case "closure":
        return "Full Closure";
      case "force_closure":
        return "Force Closure";
      default:
        return type;
    }
  };

  // Filter payments based on search term
  const filteredPayments = paymentsData?.payments.filter((payment) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      payment.order?.order_number?.toLowerCase().includes(searchLower) ||
      payment.order?.sku?.toLowerCase().includes(searchLower) ||
      payment.remarks?.toLowerCase().includes(searchLower) ||
      payment.created_by?.toLowerCase().includes(searchLower)
    );
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-48" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load payment history: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!paymentsData?.payments?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No payments found</h3>
          <p className="text-muted-foreground">
            No payment records exist for this vendor yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-semibold">
                  {paymentsData.statistics.total_payments}
                </p>
                <p className="text-sm text-muted-foreground">Total Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-semibold">
                  {formatCurrency(paymentsData.statistics.total_amount_paid)}
                </p>
                <p className="text-sm text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-semibold">
                  {paymentsData.statistics.payment_types.part_payment + 
                   paymentsData.statistics.payment_types.advance}
                </p>
                <p className="text-sm text-muted-foreground">Partial Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-semibold">
                  {paymentsData.statistics.payment_types.closure + 
                   paymentsData.statistics.payment_types.force_closure}
                </p>
                <p className="text-sm text-muted-foreground">Completed Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="advance">Advance</SelectItem>
            <SelectItem value="part_payment">Part Payment</SelectItem>
            <SelectItem value="closure">Full Closure</SelectItem>
            <SelectItem value="force_closure">Force Closure</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment List */}
      <div className="space-y-4">
        {filteredPayments.map((payment) => (
          <PaymentCard
            key={payment.id}
            payment={payment}
            isExpanded={expandedPayments.has(payment.id)}
            onToggleExpanded={() => toggleExpanded(payment.id)}
            formatCurrency={formatCurrency}
            formatPaymentType={formatPaymentType}
            getPaymentTypeVariant={getPaymentTypeVariant}
            getPaymentTypeColor={getPaymentTypeColor}
          />
        ))}
      </div>
    </div>
  );
}

interface PaymentCardProps {
  payment: any;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  formatCurrency: (amount: number) => string;
  formatPaymentType: (type: string) => string;
  getPaymentTypeVariant: (type: string) => string;
  getPaymentTypeColor: (type: string) => string;
}

function PaymentCard({
  payment,
  isExpanded,
  onToggleExpanded,
  formatCurrency,
  formatPaymentType,
  getPaymentTypeVariant,
  getPaymentTypeColor,
}: PaymentCardProps) {
  const { data: receipts } = usePaymentReceipts(payment.id);

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Receipt className={cn("h-5 w-5", getPaymentTypeColor(payment.payment_type))} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg">
                      {formatCurrency(payment.amount_paid)}
                    </span>
                    <Badge variant={getPaymentTypeVariant(payment.payment_type) as any}>
                      {formatPaymentType(payment.payment_type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                    </div>
                    {payment.order && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {payment.order.order_number} • {payment.order.sku}
                      </div>
                    )}
                    {payment.created_by && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {payment.created_by.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {receipts?.receipts?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {receipts.receipts.length} receipt{receipts.receipts.length > 1 ? 's' : ''}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <h4 className="font-medium mb-2">Payment Details</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Order Amount:</span>{" "}
                    {formatCurrency(payment.total_order_amount)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Remaining:</span>{" "}
                    {formatCurrency(payment.remaining_amount)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    {format(new Date(payment.payment_date), "PPP")}
                  </p>
                  {payment.is_carried_forward && (
                    <Badge variant="outline" className="text-xs">
                      Carried Forward
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Remarks</h4>
                <p className="text-sm text-muted-foreground">
                  {payment.remarks || "No remarks provided"}
                </p>
              </div>

              {receipts?.receipts?.length ? (
                <div className="md:col-span-2">
                  <h4 className="font-medium mb-2">Receipts</h4>
                  <div className="flex gap-2 flex-wrap">
                    {receipts.receipts.map((receipt: any) => (
                      <Button
                        key={receipt.id}
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(receipt.signedUrl, '_blank')}
                        className="text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {receipt.file_name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}