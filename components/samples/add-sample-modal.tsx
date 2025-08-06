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
import { useUploadSampleImage } from "@/hooks/queries/use-sample-images";

const addSampleSchema = z
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

type AddSampleForm = z.infer<typeof addSampleSchema>;

interface AddSampleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSampleModal({ open, onOpenChange }: AddSampleModalProps) {
  const queryClient = useQueryClient();
  const [isLoadingSKUs, setIsLoadingSKUs] = useState(false);
  const [skuOptions, setSkuOptions] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<Array<{
    s3Key: string;
    s3Url: string;
    fileName: string;
    imageType: string;
  }>>([]);

  const form = useForm<AddSampleForm>({
    resolver: zodResolver(addSampleSchema),
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

  const uploadSampleImageMutation = useUploadSampleImage();

  const createSampleMutation = useMutation({
    mutationFn: async (data: AddSampleForm) => {
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sample");
      }

      return response.json();
    },
    onSuccess: async (createdSample) => {
      // After sample is created, associate any uploaded images
      if (uploadedImages.length > 0) {
        try {
          for (const image of uploadedImages) {
            await uploadSampleImageMutation.mutateAsync({
              sampleId: createdSample.id,
              s3Key: image.s3Key,
              s3Url: image.s3Url,
              fileName: image.fileName,
              fileSizeBytes: 0, // We don't track this in the temp storage
              contentType: "image/jpeg", // Default, could be improved
              imageType: image.imageType,
            });
          }
        } catch (error) {
          console.error("Failed to associate some images:", error);
          // Don't fail the entire operation if image association fails
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      toast.success("Sample created successfully");
      form.reset();
      setUploadedImages([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: AddSampleForm) => {
    // Transform the data to match API expectations
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

    console.log('Form data being submitted:', formattedData);
    console.log('Filtered attributes:', formattedData.attributes);

    createSampleMutation.mutate(formattedData);
  };

  const addAttribute = () => {
    append({
      attribute_name: "",
      attribute_value: "",
      vendor_id: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Sample</DialogTitle>
          <DialogDescription>Create a new sample record.</DialogDescription>
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

            <Separator />

            {/* Images Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Sample Images
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload images of the sample for better identification
                  </p>
                </div>
              </div>

              {/* Show uploaded images */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative border rounded-lg p-2">
                      <img
                        src={image.s3Url}
                        alt={image.fileName}
                        className="w-full h-24 object-cover rounded"
                      />
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p className="truncate">{image.fileName}</p>
                        <p className="capitalize">{image.imageType}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedImages(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive/90"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom image uploader for new samples */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Sample Images</h3>
                    <p className="text-muted-foreground mb-4">
                      Select images to upload. They will be associated with the sample after creation.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="w-full p-2 border border-muted-foreground/25 rounded"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;

                      for (const file of files) {
                        try {
                          // Validate file type
                          if (!file.type.startsWith('image/')) {
                            toast.error(`${file.name} is not an image file`);
                            continue;
                          }

                          // Validate file size (max 10MB)
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error(`${file.name} is too large (max 10MB)`);
                            continue;
                          }

                          console.log(`Starting upload for ${file.name}...`);
                          
                          // Get presigned URL
                          const presignedResponse = await fetch("/api/upload/presigned-url", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fileName: file.name,
                              contentType: file.type,
                              type: "sample",
                              entityId: "temp-sample-id",
                            }),
                          });

                          if (!presignedResponse.ok) {
                            const errorData = await presignedResponse.json();
                            console.error("Presigned URL error:", errorData);
                            throw new Error(errorData.error || "Failed to get upload URL");
                          }

                          const { presignedUrl, s3Key } = await presignedResponse.json();
                          console.log(`Got presigned URL for ${file.name}, S3 key: ${s3Key}`);

                          // Upload directly to S3
                          const uploadResponse = await fetch(presignedUrl, {
                            method: "PUT",
                            body: file,
                            headers: { "Content-Type": file.type },
                          });

                          if (!uploadResponse.ok) {
                            console.error("S3 upload error:", uploadResponse.status, uploadResponse.statusText);
                            throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
                          }

                          // Store for later association
                          const s3Url = `https://trakurebucket.s3.ap-south-1.amazonaws.com/${s3Key}`;
                          setUploadedImages(prev => [...prev, {
                            s3Key,
                            s3Url,
                            fileName: file.name,
                            imageType: "general",
                          }]);

                          console.log(`Successfully uploaded ${file.name}`);
                          toast.success(`${file.name} uploaded successfully`);
                        } catch (error) {
                          console.error("Upload error for", file.name, ":", error);
                          const errorMessage = error instanceof Error ? error.message : "Unknown error";
                          toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createSampleMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSampleMutation.isPending || uploadSampleImageMutation.isPending}>
                {createSampleMutation.isPending || uploadSampleImageMutation.isPending
                  ? "Creating..."
                  : "Create Sample"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
