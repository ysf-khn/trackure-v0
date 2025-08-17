"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { EnhancedImageUploader } from "./enhanced-image-uploader";

// Define Zod schema for form validation
const remarkFormSchema = z.object({
  text: z
    .string()
    .min(1, "Remark cannot be empty")
    .max(1000, "Remark is too long"),
});

type RemarkFormData = z.infer<typeof remarkFormSchema>;

// Define expected type for the remark returned by the API
interface CreatedRemark {
  id: string;
}

interface AddRemarkModalProps {
  itemId: string;
  children: React.ReactNode;
}

// API call function to create remark
async function addRemarkApi(
  itemId: string,
  data: RemarkFormData
): Promise<CreatedRemark> {
  const response = await fetch(`/api/items/${itemId}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to add remark");
  }
  return response.json();
}

// API call function to upload image
async function uploadImageApi(
  itemId: string,
  imageData: {
    s3Key: string;
    s3Url?: string;
    fileName?: string;
    fileSizeBytes?: number;
    contentType?: string;
  },
  remarkId: string
) {
  const response = await fetch(`/api/items/${itemId}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...imageData,
      remarkId: remarkId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to upload image");
  }
  return response.json();
}

export function AddRemarkModal({ itemId, children }: AddRemarkModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    file: File;
    previewUrl: string;
    s3Key?: string;
    s3Url?: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const {
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();

  const form = useForm<RemarkFormData>({
    resolver: zodResolver(remarkFormSchema),
    defaultValues: {
      text: "",
    },
  });

  // Reset everything when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setSelectedImage(null);
      setShowSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, form]);

  // Auto close after success
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setIsOpen(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const handleSubmit = async (data: RemarkFormData) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Step 1: Create the remark
      const newRemark = await addRemarkApi(itemId, data);
      
      // Step 2: If there's an image, upload it
      if (selectedImage && selectedImage.s3Key) {
        const imageData: any = {
          s3Key: selectedImage.s3Key,
          fileName: selectedImage.file.name,
          fileSizeBytes: selectedImage.file.size,
          contentType: selectedImage.file.type,
        };
        
        // Only include s3Url if it's a valid URL
        if (selectedImage.s3Url && selectedImage.s3Url.trim()) {
          imageData.s3Url = selectedImage.s3Url;
        }
        
        await uploadImageApi(itemId, imageData, newRemark.id);
      }

      // Step 3: Show success and invalidate queries
      setShowSuccess(true);
      toast.success(
        selectedImage 
          ? "Remark and image saved successfully!" 
          : "Remark saved successfully!"
      );
      
      queryClient.invalidateQueries({ queryKey: ["itemRemarks", itemId] });
      queryClient.invalidateQueries({ queryKey: ["itemHistory", itemId] });
      queryClient.invalidateQueries({ queryKey: ["itemImages", itemId] });
      
    } catch (error) {
      console.error("Error saving remark:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save remark"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Remark</DialogTitle>
          <DialogDescription>
            Add a text remark for this item. You can optionally attach an image.
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <h3 className="text-lg font-medium">Remark Saved!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedImage 
                  ? "Your remark and image have been saved successfully."
                  : "Your remark has been saved successfully."
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {(isAuthLoading || authError || !organizationId) && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {isAuthLoading
                    ? "Loading user data..."
                    : authError
                      ? `Authentication error: ${authError}`
                      : "Could not determine organization ID. Cannot upload images."}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remark Text</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your remark here..."
                          rows={4}
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Separator className="mb-4" />
                  <EnhancedImageUploader
                    itemId={itemId}
                    organizationId={organizationId || ""}
                    disabled={isSubmitting || isAuthLoading || !organizationId}
                    onImageSelected={setSelectedImage}
                    selectedImage={selectedImage}
                  />
                </div>
              </div>
            </Form>

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit(handleSubmit)}
                disabled={isSubmitting || !form.formState.isValid}
              >
                {isSubmitting ? "Saving..." : "Save Remark"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}