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
  const skus = skuData?.skus || [];
  const stats = skuData?.stats;

  // Filter and sort SKUs
  const filteredSKUs = skus
    .filter(
      (sku) =>
        sku.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sku.sku_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "cost":
          return (
            (b.final_calculated_cost || 0) - (a.final_calculated_cost || 0)
          );
        case "items":
          return b.active_items_count - a.active_items_count;
        case "vendors":
          return b.vendors_count - a.vendors_count;
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
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_skus || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.active_skus || 0} active
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
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_active_items || 0}
            </div>
            <p className="text-xs text-muted-foreground">In workflow</p>
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
              placeholder="Search SKUs..."
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
              <SelectItem value="cost">Cost (High-Low)</SelectItem>
              <SelectItem value="items">Items Count</SelectItem>
              <SelectItem value="vendors">Vendors Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SKUs Table */}
      {filteredSKUs.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {skus.length === 0
                ? "No SKUs found"
                : "No SKUs match your search"}
            </h3>
            <p className="text-muted-foreground">
              {skus.length === 0
                ? "SKUs will appear here as they are added to your system."
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
                  <TableHead>Cost</TableHead>
                  <TableHead>Active Items</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Workflow Stages</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSKUs.map((sku) => (
                  <TableRow
                    key={sku.sku}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell
                      className="font-mono text-sm font-medium"
                      onClick={() => setSelectedSKU(sku.sku)}
                    >
                      {sku.sku}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      {sku.final_calculated_cost ? (
                        <div>
                          <span className="font-medium">
                            ₹{Math.round(sku.final_calculated_cost)}
                          </span>
                          {sku.last_calculated_at && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(
                                sku.last_calculated_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCostModal(sku.sku);
                          }}
                        >
                          <Calculator className="h-3 w-3 mr-1" />
                          Calculate
                        </Button>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      <Badge
                        variant={
                          sku.active_items_count > 0 ? "default" : "secondary"
                        }
                        className="bg-primary text-white"
                      >
                        {sku.active_items_count}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      <Badge
                        variant={
                          sku.completed_items_count > 0
                            ? "default"
                            : "secondary"
                        }
                        className="bg-primary text-white"
                      >
                        {sku.completed_items_count}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      <div className="flex items-center gap-2">
                        <span>{sku.workflow_stages_count}</span>
                        {sku.workflow_stages_count > 0 && (
                          <Workflow className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      <div className="flex items-center gap-2">
                        <span>{sku.vendors_count}</span>
                        {sku.vendors_count > 0 && (
                          <Users className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      <Badge
                        variant={
                          sku.samples_count > 0 ? "default" : "secondary"
                        }
                        className="bg-primary text-white"
                      >
                        {sku.samples_count}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSKU(sku.sku)}>
                      {sku.last_movement ? (
                        <span className="text-sm text-muted-foreground">
                          {new Date(sku.last_movement).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSKU(sku.sku)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCostModal(sku.sku)}
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
