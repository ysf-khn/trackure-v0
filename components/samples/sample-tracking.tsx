"use client";

import { useState } from "react";
import { 
  Plus, 
  Package, 
  MapPin, 
  Calendar, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSamples } from "@/hooks/queries/use-samples";
import { AddSampleModal } from "./add-sample-modal";
import { SampleDetailsModal } from "./sample-details-modal";

const statusColors = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  with_customer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_production: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  lost: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function SampleTracking() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: samplesData, isLoading, error } = useSamples();
  const samples = samplesData?.samples || [];
  const meta = samplesData?.meta;

  // Filter samples based on search and status
  const filteredSamples = samples.filter(sample => {
    const matchesSearch = 
      sample.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sample.sample_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sample.sku && sample.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || sample.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
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
          Failed to load samples: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta?.total_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{meta?.available_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Customer</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{meta?.with_customer_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Production</CardTitle>
            <Package className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{meta?.in_production_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <Package className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(meta?.damaged_count || 0) + (meta?.lost_count || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search samples..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="with_customer">With Customer</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Sample
        </Button>
      </div>

      {/* Samples Table */}
      {filteredSamples.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {samples.length === 0 ? "No samples yet" : "No samples match your filters"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {samples.length === 0 
                ? "Get started by adding your first sample to track physical items." 
                : "Try adjusting your search or filter criteria."}
            </p>
            {samples.length === 0 && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Sample
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sample Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Received From</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Attributes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSamples.map((sample) => (
                  <TableRow key={sample.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell 
                      className="font-mono text-sm font-medium"
                      onClick={() => setSelectedSample(sample.id)}
                    >
                      {sample.sample_code}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <div>
                        <p className="font-medium">{sample.name}</p>
                        {sample.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {sample.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      {sample.sku ? (
                        <span className="font-mono text-sm">{sample.sku}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <Badge className={statusColors[sample.status as keyof typeof statusColors]}>
                        {sample.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      {sample.location ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{sample.location}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      {sample.received_from || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      {sample.received_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(sample.received_date).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <span className="text-sm text-muted-foreground">
                        {sample.attributes?.length || 0} attributes
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedSample(sample.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Sample
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Sample
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <AddSampleModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />
      
      {selectedSample && (
        <SampleDetailsModal
          sampleId={selectedSample}
          open={!!selectedSample}
          onOpenChange={(open) => !open && setSelectedSample(null)}
        />
      )}
    </div>
  );
}