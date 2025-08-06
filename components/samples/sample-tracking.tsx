"use client";

import { useState } from "react";
import { 
  Plus, 
  Package, 
  MapPin, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Building,
  Users,
  Truck,
  Hash,
  Image as ImageIcon
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
import { EditSampleModal } from "./edit-sample-modal";
import { SampleDetailsModal } from "./sample-details-modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { S3Image } from "@/components/ui/s3-image";

const statusIcons = {
  Available: Package,
  'With Customer': Users,
  'With Vendor': Truck,
  Returned: Building,
};

export function SampleTracking() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [editingSample, setEditingSample] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();

  const { data: samplesData, isLoading, error } = useSamples();
  const samples = samplesData?.samples || [];
  const meta = samplesData?.meta;
  
  // Delete sample mutation
  const deleteSampleMutation = useMutation({
    mutationFn: async (sampleId: string) => {
      const response = await fetch(`/api/samples?id=${sampleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete sample');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      toast.success('Sample deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
  
  const handleDeleteSample = (sampleId: string, sampleName: string) => {
    if (window.confirm(`Are you sure you want to delete the sample "${sampleName}"? This action cannot be undone.`)) {
      deleteSampleMutation.mutate(sampleId);
    }
  };

  // Filter samples based on search only (no status filter since status field was removed)
  const filteredSamples = samples.filter(sample => {
    const matchesSearch = 
      sample.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sample.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sample.location && sample.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sample.attributes?.some(attr => 
        attr.attribute_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attr.attribute_value.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
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

  // Helper function to get attribute value by name
  const getAttributeValue = (sample: any, attributeName: string) => {
    return sample.attributes?.find((attr: any) => 
      attr.attribute_name.toLowerCase() === attributeName.toLowerCase()
    )?.attribute_value;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta?.total_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all SKUs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {samples.reduce((sum, s) => sum + (s.quantity || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {new Set(samples.map(s => s.location).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique SKUs</CardTitle>
            <Hash className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {new Set(samples.map(s => s.sku)).size}
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
                ? "Get started by adding your first sample to track." 
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
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Attributes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSamples.map((sample) => (
                  <TableRow key={sample.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <div className="w-12 h-12 relative rounded overflow-hidden bg-muted">
                        {sample.thumbnailUrl ? (
                          <S3Image
                            src={sample.thumbnailUrl}
                            alt={sample.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        {sample.imageCount && sample.imageCount > 1 && (
                          <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 rounded-tl">
                            +{sample.imageCount - 1}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <p className="font-medium">{sample.name}</p>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <span className="font-mono text-sm">{sample.sku}</span>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <span className="font-medium">{sample.quantity || 0}</span>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <span className="text-sm">{sample.size || '-'}</span>
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      {sample.location || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell onClick={() => setSelectedSample(sample.id)}>
                      <div className="space-y-1">
                        {sample.attributes?.slice(0, 2).map((attr, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{attr.attribute_name}:</span>{' '}
                            <span className="text-muted-foreground">
                              {attr.attribute_value}
                              {attr.vendor?.name && (
                                <span className="text-blue-600 ml-1">({attr.vendor.name})</span>
                              )}
                            </span>
                          </div>
                        ))}
                        {(sample.attributes?.length || 0) > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{(sample.attributes?.length || 0) - 2} more
                          </div>
                        )}
                        {(!sample.attributes || sample.attributes.length === 0) && (
                          <span className="text-xs text-muted-foreground">No attributes</span>
                        )}
                      </div>
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
                          <DropdownMenuItem onClick={() => setEditingSample(sample.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Sample
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteSample(sample.id, sample.name)}
                          >
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

      <EditSampleModal
        sampleId={editingSample}
        open={!!editingSample}
        onOpenChange={(open) => !open && setEditingSample(null)}
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