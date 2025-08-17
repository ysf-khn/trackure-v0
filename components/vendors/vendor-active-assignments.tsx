"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Package, Calendar, Clock, AlertCircle } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VendorActiveAssignmentsProps {
  vendorId: string;
}

interface ActiveAssignment {
  id: string;
  sku: string;
  quantity: number;
  stage_name: string;
  stage_path: string;
  expected_completion?: string;
  assigned_at: string;
  customer_order_number: string;
  customer_name: string;
  status: string;
  sku_details?: {
    master_details?: {
      name?: string;
    };
  };
}

export function VendorActiveAssignments({
  vendorId,
}: VendorActiveAssignmentsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-active-assignments", vendorId],
    queryFn: async () => {
      const response = await fetch(
        `/api/vendors/${vendorId}/orders?status=in_progress&include_payments=false`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch active assignments");
      }
      return response.json();
    },
  });

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === "INR" ? "₹" : currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load active assignments: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const activeAssignments = data?.orders || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.in_progress_orders || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(activeAssignments.map((a: any) => a.sku)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Different products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {
                activeAssignments.filter((a: any) => 
                  a.expected_completion && 
                  new Date(a.expected_completion) < new Date()
                ).length
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Past expected completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Assignments</CardTitle>
          <CardDescription>
            SKUs currently being worked on by this vendor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeAssignments.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active assignments</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Order</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Expected Completion</TableHead>
                  <TableHead>Days Active</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAssignments.map((assignment: ActiveAssignment) => {
                  const daysActive = getDaysAgo(assignment.assigned_at);
                  const isOverdue = assignment.expected_completion && 
                                   new Date(assignment.expected_completion) < new Date();

                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{assignment.customer_order_number}</p>
                          <p className="text-xs text-muted-foreground">{assignment.customer_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{assignment.sku}</p>
                          {assignment.sku_details?.master_details?.name && (
                            <p className="text-sm text-muted-foreground">
                              {assignment.sku_details.master_details.name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{assignment.stage_name}</p>
                          <p className="text-xs text-muted-foreground">{assignment.stage_path}</p>
                        </div>
                      </TableCell>
                      <TableCell>{assignment.quantity}</TableCell>
                      <TableCell>
                        {assignment.expected_completion ? (
                          <div className={`${isOverdue ? 'text-destructive' : ''}`}>
                            <p className="text-sm">
                              {format(new Date(assignment.expected_completion), "PPP")}
                            </p>
                            {isOverdue && (
                              <p className="text-xs text-destructive font-medium">
                                Overdue
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-sm ${daysActive > 7 ? 'text-orange-600' : ''}`}>
                            {daysActive}d
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                          In Progress
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}