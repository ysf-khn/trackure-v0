"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Package,
  MapPin,
  Edit,
  Trash2,
  History,
  Image as ImageIcon,
  Hash,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useSampleHistory } from "@/hooks/queries/use-sample-history";
import {
  useSampleImages,
  useDeleteSampleImage,
  getSampleImageUrl,
  getImageTypeLabel,
} from "@/hooks/queries/use-sample-images";
import { ImageUploader } from "@/components/ui/image-uploader";
import { S3Image } from "@/components/ui/s3-image";
import {
  Dialog as ImageDialog,
  DialogContent as ImageDialogContent,
  DialogTrigger as ImageDialogTrigger,
} from "@/components/ui/dialog";

interface SampleDetailsModalProps {
  sampleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const changeTypeLabels = {
  created: "Sample Created",
  updated: "Sample Updated",
  location_changed: "Location Changed",
  quantity_changed: "Quantity Changed",
  attribute_changed: "Attributes Changed",
  deleted: "Sample Deleted",
};

const changeTypeColors = {
  created: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  updated: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  location_changed:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  quantity_changed:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  attribute_changed:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function SampleDetailsModal({
  sampleId,
  open,
  onOpenChange,
}: SampleDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [showImageUploader, setShowImageUploader] = useState(false);

  const {
    data: sampleResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sample", sampleId],
    queryFn: async () => {
      const response = await fetch(`/api/samples?id=${sampleId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sample details");
      }
      const data = await response.json();
      // Find the specific sample
      return data.samples?.find((s: any) => s.id === sampleId);
    },
    enabled: open && !!sampleId,
  });

  const { data: historyData, isLoading: historyLoading } = useSampleHistory(
    sampleId,
    open && activeTab === "history"
  );
  const { data: sampleImages, isLoading: imagesLoading } = useSampleImages(
    sampleId,
    open && activeTab === "details"
  );
  const deleteSampleImageMutation = useDeleteSampleImage();

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

  const sample = sampleResponse;
  if (!sample) {
    return null;
  }

  const getLocationDisplay = () => {
    const Icon = MapPin; // Default icon
    const locationText = sample.location || "Unknown Location";

    return { Icon, text: locationText };
  };

  const formatChangeValue = (value: any): string => {
    if (!value) return "-";
    if (typeof value === "object") {
      if (value.type && value.details) {
        // Location change
        return `${value.type}: ${value.details.vendor_name || value.details.customer_name || value.details.location_name || value.details.internal_location || "Unknown"}`;
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const location = getLocationDisplay();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Package className="h-5 w-5" />
                Sample Details
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <span className="font-medium">{sample.name}</span>
                {sample.sku && (
                  <>
                    <span>•</span>
                    <span>SKU: {sample.sku}</span>
                  </>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
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
            <Package className="h-4 w-4 mr-2" />
            Details
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Size</p>
                      <p className="text-lg">{sample.size || "-"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1">Quantity</p>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <p className="text-lg font-medium">
                          {sample.quantity || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Location</p>
                      <div className="flex items-center gap-2">
                        <location.Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{location.text}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1">Sample Code</p>
                      <p className="text-lg font-mono">{sample.sample_code}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sample.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sample.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attributes */}
            {sample.attributes && sample.attributes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Attributes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attribute</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Vendor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sample.attributes.map((attr: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {attr.attribute_name}
                          </TableCell>
                          <TableCell>{attr.attribute_value}</TableCell>
                          <TableCell>
                            {attr.vendor ? (
                              <Link
                                href={`/vendors/${attr.vendor.id}`}
                                className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                              >
                                {attr.vendor.name}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Images Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Images</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowImageUploader(!showImageUploader)}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {showImageUploader ? "Hide Uploader" : "Add Images"}
                </Button>
              </CardHeader>
              <CardContent>
                {/* Image Uploader */}
                {showImageUploader && (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 mb-4">
                    <ImageUploader
                      itemId={sampleId}
                      organizationId="" // Will be handled by the API
                      type="sample"
                      onUploadComplete={() => {
                        setShowImageUploader(false);
                      }}
                    />
                  </div>
                )}

                {/* Images Grid */}
                {imagesLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted animate-pulse rounded-lg"
                      />
                    ))}
                  </div>
                ) : sampleImages && sampleImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sampleImages.map((image) => {
                      const imageUrl = getSampleImageUrl(image);
                      if (!imageUrl) return null;

                      return (
                        <div key={image.id} className="relative group">
                          <ImageDialog>
                            <ImageDialogTrigger asChild>
                              <div className="relative aspect-square cursor-pointer overflow-hidden rounded-lg border hover:opacity-80 transition-opacity">
                                <S3Image
                                  src={imageUrl}
                                  alt={image.file_name || "Sample image"}
                                  fill
                                  className="object-cover"
                                />
                                {/* Image Type Badge */}
                                <div className="absolute top-2 left-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {getImageTypeLabel(image.image_type)}
                                  </Badge>
                                </div>
                                {/* Delete Button */}
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSampleImageMutation.mutate({
                                      sampleId: sampleId,
                                      imageId: image.id,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </ImageDialogTrigger>
                            <ImageDialogContent className="max-w-4xl max-h-[90vh] flex items-center justify-center p-4">
                              <div className="space-y-4">
                                <S3Image
                                  src={imageUrl}
                                  alt={image.file_name || "Sample image"}
                                  width={800}
                                  height={600}
                                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                                />
                                <div className="text-center space-y-2">
                                  <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                                    <span>
                                      {getImageTypeLabel(image.image_type)}
                                    </span>
                                    {image.file_name && (
                                      <span>{image.file_name}</span>
                                    )}
                                    <span>
                                      {format(
                                        new Date(image.uploaded_at),
                                        "MMM d, yyyy"
                                      )}
                                    </span>
                                  </div>
                                  {image.caption && (
                                    <p className="text-sm">{image.caption}</p>
                                  )}
                                </div>
                              </div>
                            </ImageDialogContent>
                          </ImageDialog>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No images uploaded
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Upload images to visually document this sample.
                    </p>
                    <Button onClick={() => setShowImageUploader(true)}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Upload Images
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-64" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : historyData?.history && historyData.history.length > 0 ? (
              <div className="space-y-4">
                {historyData.history.map((entry: any) => (
                  <Card key={entry.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`p-2 rounded-full ${changeTypeColors[entry.change_type as keyof typeof changeTypeColors]}`}
                          >
                            <Clock className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">
                              {
                                changeTypeLabels[
                                  entry.change_type as keyof typeof changeTypeLabels
                                ]
                              }
                            </h4>
                            <time className="text-xs text-muted-foreground">
                              {format(new Date(entry.changed_at), "PPp")}
                            </time>
                          </div>

                          {entry.field_name && (
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                {entry.field_name
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </p>
                              {entry.old_value && entry.new_value && (
                                <div className="flex items-center gap-2 text-sm">
                                  <code className="px-2 py-1 bg-muted rounded">
                                    {formatChangeValue(entry.old_value)}
                                  </code>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <code className="px-2 py-1 bg-muted rounded">
                                    {formatChangeValue(entry.new_value)}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}

                          {entry.change_reason && (
                            <p className="text-sm text-muted-foreground italic">
                              "{entry.change_reason}"
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground">
                            by {entry.changed_by_name}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No history yet</h3>
                  <p className="text-muted-foreground">
                    Change history will appear here as modifications are made to
                    this sample.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
