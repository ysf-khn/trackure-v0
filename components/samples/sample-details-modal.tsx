"use client";

import { useState } from "react";
import { 
  Package, 
  MapPin, 
  Calendar, 
  User, 
  Tag, 
  Edit, 
  Trash2, 
  History,
  Image as ImageIcon,
  ExternalLink
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SampleDetailsModalProps {
  sampleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  with_customer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_production: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  lost: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function SampleDetailsModal({
  sampleId,
  open,
  onOpenChange,
}: SampleDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "attributes" | "history" | "images">("details");

  const { data: sample, isLoading, error } = useQuery({
    queryKey: ["sample", sampleId],
    queryFn: async () => {
      const response = await fetch(`/api/samples/${sampleId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sample details");
      }
      return response.json();
    },
    enabled: open && !!sampleId,
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load sample details: {error.message}
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  const sampleData = sample?.sample;
  if (!sampleData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Package className="h-5 w-5" />
                {sampleData.name}
              </DialogTitle>
              <DialogDescription>
                Sample Code: {sampleData.sample_code}
                {sampleData.sku && ` • SKU: ${sampleData.sku}`}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[sampleData.status as keyof typeof statusColors]}>
                {sampleData.status.replace('_', ' ')}
              </Badge>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === "details" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("details")}
            className="flex-1"
          >
            Details
          </Button>
          <Button
            variant={activeTab === "attributes" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("attributes")}
            className="flex-1"
          >
            Attributes ({sampleData.attributes?.length || 0})
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="flex-1"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            variant={activeTab === "images" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("images")}
            className="flex-1"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Images ({sampleData.image_count || 0})
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sampleData.description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{sampleData.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sampleData.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">{sampleData.location}</p>
                      </div>
                    </div>
                  )}

                  {sampleData.received_from && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Received From</p>
                        <p className="text-sm text-muted-foreground">{sampleData.received_from}</p>
                      </div>
                    </div>
                  )}

                  {sampleData.received_date && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Received Date</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sampleData.received_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {sampleData.sku && (
                    <div className="flex items-center gap-3">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Associated SKU</p>
                        <p className="text-sm text-muted-foreground font-mono">{sampleData.sku}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sampleData.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sampleData.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "attributes" && (
          <div className="space-y-4">
            {sampleData.attributes && sampleData.attributes.length > 0 ? (
              <div className="space-y-4">
                {/* Group attributes by category */}
                {Object.entries(
                  sampleData.attributes.reduce((acc, attr) => {
                    if (!acc[attr.category]) acc[attr.category] = [];
                    acc[attr.category].push(attr);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).map(([category, attrs]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">
                        {category} Attributes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {attrs.map((attr, index) => (
                          <div key={index} className="space-y-1">
                            <p className="text-sm font-medium">{attr.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {attr.value}
                              {attr.unit && ` ${attr.unit}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No attributes</h3>
                  <p className="text-muted-foreground mb-4">
                    No attributes have been defined for this sample yet.
                  </p>
                  <Button>
                    <Edit className="h-4 w-4 mr-2" />
                    Add Attributes
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            <Card className="text-center py-12">
              <CardContent>
                <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Movement history coming soon</h3>
                <p className="text-muted-foreground">
                  Sample movement history will be displayed here once implemented.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "images" && (
          <div className="space-y-4">
            <Card className="text-center py-12">
              <CardContent>
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No images uploaded</h3>
                <p className="text-muted-foreground mb-4">
                  Upload images to visually document this sample.
                </p>
                <Button>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload Images
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}