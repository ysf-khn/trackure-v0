"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Plus,
  TrendingUp,
  Package,
  DollarSign,
  Users,
  Workflow,
  Eye,
  Settings,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSKUManagement } from "@/hooks/queries/use-sku-management";
import { SKUDetailsModal } from "./sku-details-modal";
import { CostCalculationModal } from "./cost-calculation-modal";

export function SKUManagement() {
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [costModalSKU, setCostModalSKU] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("sku");

  const { data: skuData, isLoading, error } = useSKUManagement();
  const skuOrders = skuData?.sku_orders || [];
  const stats = skuData?.stats;

  // Filter and sort SKU-Order combinations
  const filteredSKUOrders = skuOrders
    .filter(
      (record) =>
        record.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.sku_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.buyer_id && record.buyer_id.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "cost":
          return (
            (b.estimated_workflow_cost || b.final_calculated_cost || 0) - 
            (a.estimated_workflow_cost || a.final_calculated_cost || 0)
          );
        case "items":
          return b.active_items_for_order - a.active_items_for_order;
        case "vendors":
          return b.vendors_count - a.vendors_count;
        case "order":
          return a.order_number.localeCompare(b.order_number);
        case "sku":
        default:
          return a.sku.localeCompare(b.sku);
      }
    });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load SKU data: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const openCostModal = (sku: string) => {
    setCostModalSKU(sku);
    setIsCostModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SKU-Order Combinations</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_sku_order_combinations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.unique_skus || 0} unique SKUs, {stats?.unique_orders || 0} orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{stats?.avg_cost ? Math.round(stats.avg_cost) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Per unit average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Workflow Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{Math.round(stats?.total_estimated_workflow_cost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total estimated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_vendors || 0}
            </div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SKUs, orders, buyers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sku">SKU (A-Z)</SelectItem>
              <SelectItem value="order">Order Number</SelectItem>
              <SelectItem value="cost">Estimated Cost (High-Low)</SelectItem>
              <SelectItem value="items">Items Count</SelectItem>
              <SelectItem value="vendors">Vendors Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SKU-Order Combinations Table */}
      {filteredSKUOrders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {skuOrders.length === 0
                ? "No SKU-Order combinations found"
                : "No combinations match your search"}
            </h3>
            <p className="text-muted-foreground">
              {skuOrders.length === 0
                ? "SKU-Order combinations will appear here as orders are created."
                : "Try adjusting your search criteria."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Items (A/C)</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Est. Cost</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSKUOrders.map((record) => (
                  <TableRow
                    key={`${record.sku}-${record.order_id}`}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell
                      className="font-mono text-sm font-medium"
                      onClick={() => setSelectedSKU(record.sku)}
                    >
                      <div>
                        {record.sku}
                        {record.is_component_item && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Component
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      <div>
                        <span className="font-medium">{record.order_number}</span>
                        <p className="text-xs text-muted-foreground">
                          {record.order_status}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      <span className="text-sm">
                        {record.buyer_id || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      <div className="flex gap-1">
                        <Badge
                          variant={
                            record.active_items_for_order > 0 ? "default" : "secondary"
                          }
                          className="bg-blue-500 text-white"
                        >
                          {record.active_items_for_order}
                        </Badge>
                        <Badge
                          variant={
                            record.completed_items_for_order > 0 ? "default" : "secondary"
                          }
                          className="bg-green-500 text-white"
                        >
                          {record.completed_items_for_order}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      {record.has_active_template && record.active_template_name ? (
                        <div>
                          <Badge variant="default" className="bg-purple-500 text-white">
                            {record.active_template_name}
                          </Badge>
                          {record.template_usage_count && (
                            <p className="text-xs text-muted-foreground">
                              Used {record.template_usage_count} times
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No template</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      {record.estimated_workflow_cost ? (
                        <div>
                          <span className="font-medium">
                            ₹{Math.round(record.estimated_workflow_cost)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Workflow est.
                          </p>
                        </div>
                      ) : record.final_calculated_cost ? (
                        <div>
                          <span className="font-medium">
                            ₹{Math.round(record.final_calculated_cost)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Base cost
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCostModal(record.sku);
                          }}
                        >
                          <Calculator className="h-3 w-3 mr-1" />
                          Calculate
                        </Button>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      <div className="flex items-center gap-2">
                        <span>{record.vendors_count}</span>
                        {record.vendors_count > 0 && (
                          <Users className="h-3 w-3 text-muted-foreground" />
                        )}
                        {record.avg_vendor_price && (
                          <p className="text-xs text-muted-foreground">
                            Avg: ₹{Math.round(record.avg_vendor_price)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(record.sku)}>
                      <Badge
                        variant={
                          record.sku_order_status === "All Completed" ? "default" :
                          record.sku_order_status === "Partially Completed" ? "secondary" :
                          record.sku_order_status === "In Progress" ? "outline" : "secondary"
                        }
                        className={
                          record.sku_order_status === "All Completed" ? "bg-green-500 text-white" :
                          record.sku_order_status === "Partially Completed" ? "bg-yellow-500 text-white" :
                          record.sku_order_status === "In Progress" ? "bg-blue-500 text-white" : ""
                        }
                      >
                        {record.sku_order_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSKU(record.sku)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCostModal(record.sku)}
                        >
                          <Calculator className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {selectedSKU && (
        <SKUDetailsModal
          sku={selectedSKU}
          open={!!selectedSKU}
          onOpenChange={(open) => !open && setSelectedSKU(null)}
        />
      )}

      {costModalSKU && (
        <CostCalculationModal
          sku={costModalSKU}
          open={isCostModalOpen}
          onOpenChange={(open) => {
            setIsCostModalOpen(open);
            if (!open) setCostModalSKU(null);
          }}
        />
      )}
    </div>
  );
}
