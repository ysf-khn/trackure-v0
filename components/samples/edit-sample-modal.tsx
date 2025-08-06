"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Package, Image as ImageIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useVendors } from "@/hooks/queries/use-vendors";
import { ImageUploader } from "@/components/ui/image-uploader";
import { useSampleImages, useDeleteSampleImage, getSampleImageUrl, getImageTypeLabel } from "@/hooks/queries/use-sample-images";
import { S3Image } from "@/components/ui/s3-image";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const editSampleSchema = z
  .object({
    sku: z.string().min(1, "SKU is required"),
    name: z.string().min(1, "Name is required"),
    quantity: z.string().min(1, "Quantity is required"),
    size: z.string().min(1, "Size is required"),
    location_type: z.enum(["own_org", "vendor", "buyer", "custom"], {
      required_error: "Location type is required",
    }),
    location_value: z.string().optional(),
    vendor_id: z.string().optional(),

    // Attributes
    attributes: z.array(
      z.object({
        attribute_name: z.string().min(1, "Attribute name is required"),
        attribute_value: z.string().min(1, "Value is required"),
        vendor_id: z.string().optional(),
      })
    ),
  })
  .refine(
    (data) => {
      // Validate vendor selection when location_type is 'vendor'
      if (data.location_type === "vendor" && !data.vendor_id) {
        return false;
      }
      // Validate location_value when location_type is 'buyer' or 'custom'
      if (
        (data.location_type === "buyer" || data.location_type === "custom") &&
        !data.location_value?.trim()
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Please provide required location details",
      path: ["location_value"],
    }
  );

type EditSampleForm = z.infer<typeof editSampleSchema>;

interface EditSampleModalProps {
  sampleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSampleModal({ sampleId, open, onOpenChange }: EditSampleModalProps) {
  const queryClient = useQueryClient();
  const [isLoadingSKUs, setIsLoadingSKUs] = useState(false);
  const [skuOptions, setSkuOptions] = useState<string[]>([]);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "images">("details");

  // Sample images data
  const { data: sampleImages, isLoading: imagesLoading } = useSampleImages(sampleId || "", open && !!sampleId);
  const deleteSampleImageMutation = useDeleteSampleImage();

  const form = useForm<EditSampleForm>({
    resolver: zodResolver(editSampleSchema),
    defaultValues: {
      sku: "",
      name: "",
      quantity: "",
      size: "",
      location_type: "own_org",
      location_value: "",
      vendor_id: "",
      attributes: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  // Watch location type for conditional rendering
  const locationType = form.watch("location_type");

  // Fetch vendors
  const { data: vendorsData } = useVendors(false);
  const vendors = vendorsData?.vendors || [];

  // Fetch sample data
  const { data: sampleData } = useQuery({
    queryKey: ["sample", sampleId],
    queryFn: async () => {
      const response = await fetch(`/api/samples`);
      if (!response.ok) throw new Error("Failed to fetch samples");
      const data = await response.json();
      return data.samples?.find((s: any) => s.id === sampleId);
    },
    enabled: open && !!sampleId,
  });

  // Populate form when sample data is loaded
  useEffect(() => {
    if (sampleData && open) {
      // Parse location into location_type and location_value
      let locationType = "own_org";
      let locationValue = "";
      let vendorId = "";

      if (sampleData.location) {
        if (sampleData.location.startsWith("Own Organization")) {
          locationType = "own_org";
          locationValue = sampleData.location.replace("Own Organization - ", "").replace("Own Organization", "");
        } else if (sampleData.location.startsWith("Buyer")) {
          locationType = "buyer";
          locationValue = sampleData.location.replace("Buyer - ", "");
        } else if (vendors.find(v => v.name === sampleData.location)) {
          locationType = "vendor";
          const vendor = vendors.find(v => v.name === sampleData.location);
          vendorId = vendor?.id || "";
        } else {
          locationType = "custom";
          locationValue = sampleData.location;
        }
      }

      form.reset({
        sku: sampleData.sku || "",
        name: sampleData.name || "",
        quantity: String(sampleData.quantity || 0),
        size: sampleData.size || "",
        location_type: locationType as any,
        location_value: locationValue,
        vendor_id: vendorId,
        attributes: sampleData.attributes?.map((attr: any) => ({
          attribute_name: attr.attribute_name || "",
          attribute_value: attr.attribute_value || "",
          vendor_id: attr.vendor_id || "",
        })) || [],
      });
    }
  }, [sampleData, open, form, vendors]);

  // Fetch SKUs
  useEffect(() => {
    const fetchSKUs = async () => {
      setIsLoadingSKUs(true);
      try {
        const response = await fetch("/api/sku-management");
        if (response.ok) {
          const data = await response.json();
          const uniqueSKUs = [
            ...new Set(data.skus?.map((s: any) => s.sku) || []),
          ];
          setSkuOptions(uniqueSKUs);
        }
      } catch (error) {
        console.error("Error fetching SKUs:", error);
      }
      setIsLoadingSKUs(false);
    };

    if (open) {
      fetchSKUs();
    }
  }, [open]);

  const updateSampleMutation = useMutation({
    mutationFn: async (data: EditSampleForm) => {
      const formattedData = {
        ...data,
        // Set location field based on location_type
        location:
          data.location_type === "own_org"
            ? `Own Organization${data.location_value ? ` - ${data.location_value}` : ""}`
            : data.location_type === "vendor" && data.vendor_id
              ? vendors.find((v) => v.id === data.vendor_id)?.name ||
                "Unknown Vendor"
              : data.location_type === "buyer"
                ? `Buyer - ${data.location_value || "Unknown"}`
                : data.location_value || "Unknown Location",
        // Filter out attributes with empty names or values
        attributes: data.attributes.filter(
          (attr) => attr.attribute_name.trim() && attr.attribute_value.trim()
        ),
      };

      console.log('Edit form data being submitted:', formattedData);
      console.log('Edit filtered attributes:', formattedData.attributes);

      const response = await fetch(`/api/samples?id=${sampleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sample");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["sample", sampleId] });
      toast.success("Sample updated successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: EditSampleForm) => {
    updateSampleMutation.mutate(data);
  };

  const addAttribute = () => {
    append({
      attribute_name: "",
      attribute_value: "",
      vendor_id: "",
    });
  };

  if (!sampleId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sample</DialogTitle>
          <DialogDescription>
            Update sample information and attributes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
          >
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoadingSKUs}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoadingSKUs ? "Loading..." : "Select SKU"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {skuOptions.map((sku) => (
                            <SelectItem key={sku} value={sku}>
                              {sku}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Polished Gold Ring"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1, 5, 10"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Number of samples</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 12mm, Medium, 5x3 inches"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Physical size or dimensions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Location Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium">Current Location *</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="own_org">
                              Our Organization
                            </SelectItem>
                            <SelectItem value="vendor">With Vendor</SelectItem>
                            <SelectItem value="buyer">With Buyer</SelectItem>
                            <SelectItem value="custom">
                              Other Location
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {locationType === "vendor" && (
                    <FormField
                      control={form.control}
                      name="vendor_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Vendor</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose vendor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {(locationType === "buyer" || locationType === "custom") && (
                    <FormField
                      control={form.control}
                      name="location_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {locationType === "buyer"
                              ? "Buyer Name"
                              : "Location Details"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                locationType === "buyer"
                                  ? "e.g., ABC Corp, John Smith"
                                  : "e.g., Shelf A1, Warehouse B"
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {locationType === "own_org" && (
                    <FormField
                      control={form.control}
                      name="location_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specific Location (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Shelf A1, Display Case"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Attributes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Sample Attributes</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add custom attributes to differentiate this sample. You can optionally link vendors.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attribute
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No attributes added yet</p>
                  <p className="text-sm">Click "Add Attribute" to start adding sample attributes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          Attribute #{index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`attributes.${index}.attribute_name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Attribute Name *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Color, Material, Finish"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`attributes.${index}.attribute_value`}
                          render={({ field: valueField }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Value *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Gold, Brass, Polished"
                                  {...valueField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`attributes.${index}.vendor_id`}
                          render={({ field: vendorField }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Vendor (Optional)</FormLabel>
                              <Select
                                onValueChange={vendorField.onChange}
                                value={vendorField.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select vendor" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {vendors.map((vendor) => (
                                    <SelectItem
                                      key={vendor.id}
                                      value={vendor.id}
                                    >
                                      {vendor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b">
              <Button
                type="button"
                variant={activeTab === "details" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("details")}
                className="flex-1 rounded-b-none"
              >
                <Package className="h-4 w-4 mr-2" />
                Details
              </Button>
              <Button
                type="button"
                variant={activeTab === "images" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("images")}
                className="flex-1 rounded-b-none"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Images ({sampleImages?.length || 0})
              </Button>
            </div>

            {/* Images Tab Content */}
            {activeTab === "images" && sampleId && (
              <div className="space-y-4">
                {/* Upload Section */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Sample Images</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowImageUploader(!showImageUploader)}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {showImageUploader ? "Hide Uploader" : "Add Images"}
                  </Button>
                </div>

                {/* Image Uploader */}
                {showImageUploader && (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                    <ImageUploader
                      itemId={sampleId}
                      organizationId="" // Will be handled by the API
                      type="sample"
                      onUploadComplete={() => {
                        setShowImageUploader(false);
                        // Refresh the images list
                        queryClient.invalidateQueries({ queryKey: ["sample-images", sampleId] });
                      }}
                    />
                  </div>
                )}

                {/* Images Grid */}
                {imagesLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="aspect-square bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : sampleImages && sampleImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {sampleImages.map((image) => {
                      const imageUrl = getSampleImageUrl(image);
                      if (!imageUrl) return null;

                      return (
                        <div key={image.id} className="relative group aspect-square">
                          <S3Image
                            src={imageUrl}
                            alt={image.file_name || "Sample image"}
                            fill
                            className="object-cover rounded-lg border"
                          />
                          {/* Image Type Badge */}
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary" className="text-xs">
                              {getImageTypeLabel(image.image_type)}
                            </Badge>
                          </div>
                          {/* Delete Button */}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              deleteSampleImageMutation.mutate({
                                sampleId: sampleId,
                                imageId: image.id,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {/* Image Info */}
                          <div className="absolute bottom-2 left-2 right-2">
                            <div className="bg-black/50 text-white text-xs p-2 rounded">
                              <p className="truncate">{image.file_name || "Untitled"}</p>
                              <p>{format(new Date(image.uploaded_at), "MMM d, yyyy")}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="text-center py-12">
                    <CardContent>
                      <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No images uploaded</h3>
                      <p className="text-muted-foreground mb-4">
                        Upload images to visually document this sample.
                      </p>
                      <Button type="button" onClick={() => setShowImageUploader(true)}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Upload Images
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateSampleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateSampleMutation.isPending}
              >
                {updateSampleMutation.isPending ? "Updating..." : "Update Sample"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}