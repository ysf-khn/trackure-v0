"use client";

import React, { useState } from "react";
import { useItemDetails } from "@/hooks/queries/use-item-details";
import { useItemHistory } from "@/hooks/queries/use-item-history";
import { useItemRemarks } from "@/hooks/queries/use-item-remarks";
import { useItemImages } from "@/hooks/queries/use-item-images";
import { formatDistanceToNow, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Package,
  Clock,
  MapPin,
  User,
  FileText,
  Image as ImageIcon,
  History,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ItemHistoryModal } from "./item-history-modal";

interface ItemDetailsViewProps {
  itemId: string;
}

export function ItemDetailsView({ itemId }: ItemDetailsViewProps) {
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const { data: itemDetails, isLoading, error } = useItemDetails(itemId);

  const { data: remarks, isLoading: isLoadingRemarks } = useItemRemarks(itemId);

  const { data: images, isLoading: isLoadingImages } = useItemImages(itemId);

  if (isLoading) {
    return <div>Loading item details...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Error Loading Item</h2>
          <p className="text-muted-foreground">
            {error.message || "Failed to load item details"}
          </p>
          <Button asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!itemDetails) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Item Not Found</h2>
          <p className="text-muted-foreground">
            The requested item could not be found.
          </p>
          <Button asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { item, summary, allocationsByStage, history } = itemDetails;
  const completionPercentage =
    item.total_quantity > 0
      ? Math.round((summary.completed_quantity / item.total_quantity) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Item: {item.sku}</h1>
            <Badge
              variant={item.status === "Completed" ? "default" : "secondary"}
            >
              {item.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Order: {item.order.order_number} • Customer:{" "}
            {item.order.customer_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsHistoryModalOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/orders/${item.order.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Order
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Quantity
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_quantity}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Workflow</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.quantity_in_workflow}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.quantity_in_new_pool} in new pool
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.completed_quantity}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={completionPercentage} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {completionPercentage}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentation</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>Remarks:</span>
                <span className="font-medium">{summary.remarks_count}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Images:</span>
                <span className="font-medium">{summary.images_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stages">Stage Allocations</TabsTrigger>
          <TabsTrigger value="history">Movement History</TabsTrigger>
          <TabsTrigger value="details">Item Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">SKU:</span>
                    <div className="font-medium">{item.sku}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyer ID:</span>
                    <div className="font-medium">{item.buyer_id || "N/A"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div>
                      <Badge
                        variant={
                          item.status === "Completed" ? "default" : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <div className="font-medium">
                      {format(new Date(item.created_at), "MMM dd, yyyy")}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Order Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Order Number:
                      </span>
                      <div className="font-medium">
                        {item.order.order_number}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Customer:</span>
                      <div className="font-medium">
                        {item.order.customer_name}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Stage Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Current Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {allocationsByStage.length > 0 ? (
                  <div className="space-y-3">
                    {allocationsByStage
                      .sort(
                        (a, b) =>
                          a.stage.sequence_order - b.stage.sequence_order
                      )
                      .map((stageGroup) => (
                        <div key={stageGroup.stage.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {stageGroup.stage.name}
                              </span>
                              {stageGroup.stage.location && (
                                <Badge variant="outline" className="text-xs">
                                  {stageGroup.stage.location}
                                </Badge>
                              )}
                            </div>
                            <Badge variant="secondary">
                              {stageGroup.totalQuantity}
                            </Badge>
                          </div>

                          {stageGroup.allocations.some((a) => a.sub_stage) && (
                            <div className="ml-6 space-y-1">
                              {stageGroup.allocations
                                .filter((a) => a.sub_stage)
                                .map((allocation) => (
                                  <div
                                    key={allocation.id}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      {allocation.sub_stage?.name}
                                    </span>
                                    <span>{allocation.quantity}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}

                    {summary.quantity_in_new_pool > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">New Pool</span>
                        </div>
                        <Badge variant="outline">
                          {summary.quantity_in_new_pool}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No stage allocations found
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stage Allocations</CardTitle>
            </CardHeader>
            <CardContent>
              {allocationsByStage.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Sub-Stage</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocationsByStage
                      .sort(
                        (a, b) =>
                          a.stage.sequence_order - b.stage.sequence_order
                      )
                      .flatMap((stageGroup) =>
                        stageGroup.allocations.map((allocation) => (
                          <TableRow key={allocation.id}>
                            <TableCell className="font-medium">
                              {allocation.stage.name}
                            </TableCell>
                            <TableCell>
                              {allocation.sub_stage?.name || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {allocation.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  allocation.status === "Completed"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {allocation.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {allocation.sub_stage?.location ||
                                allocation.stage.location ||
                                "-"}
                            </TableCell>
                            <TableCell>
                              {formatDistanceToNow(
                                new Date(allocation.updated_at),
                                { addSuffix: true }
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No stage allocations found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Movement History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Moved By</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 10).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(
                            new Date(entry.moved_at),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.from_stage_name ? (
                            <div>
                              <div>{entry.from_stage_name}</div>
                              {entry.from_sub_stage_name && (
                                <div className="text-xs text-muted-foreground">
                                  {entry.from_sub_stage_name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">New</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{entry.to_stage_name}</div>
                            {entry.to_sub_stage_name && (
                              <div className="text-xs text-muted-foreground">
                                {entry.to_sub_stage_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.quantity}</Badge>
                        </TableCell>
                        <TableCell>{entry.moved_by_name || "System"}</TableCell>
                        <TableCell>
                          {entry.rework_reason ? (
                            <Badge variant="destructive">Rework</Badge>
                          ) : (
                            <Badge variant="default">Forward</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No movement history found
                </p>
              )}

              {history.length > 10 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setIsHistoryModalOpen(true)}
                  >
                    View All History ({history.length} entries)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instance Details</CardTitle>
            </CardHeader>
            <CardContent>
              {item.instance_details &&
              Object.keys(item.instance_details).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attribute</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(item.instance_details).map(
                      ([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium">
                            {key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </TableCell>
                          <TableCell>
                            {typeof value === "object"
                              ? JSON.stringify(value, null, 2)
                              : String(value)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No instance details available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Modal */}
      <ItemHistoryModal
        itemId={itemId}
        itemSku={item.sku}
        isOpen={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />
    </div>
  );
}
