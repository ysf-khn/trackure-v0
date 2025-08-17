"use client";

import React, { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  UploadCloud, 
  X, 
  Image as ImageIcon, 
  RotateCcw,
  AlertTriangle 
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { compressImage } from "@/lib/image-utils";

interface SelectedImage {
  file: File;
  previewUrl: string;
  s3Key?: string;
  s3Url?: string;
}

interface EnhancedImageUploaderProps {
  itemId: string;
  organizationId: string;
  disabled?: boolean;
  onImageSelected: (image: SelectedImage | null) => void;
  selectedImage: SelectedImage | null;
}

export function EnhancedImageUploader({
  itemId,
  organizationId,
  disabled = false,
  onImageSelected,
  selectedImage,
}: EnhancedImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = event.target.files?.[0];
      
      if (!file) {
        onImageSelected(null);
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        resetInput();
        return;
      }

      setIsProcessing(true);

      try {
        // Step 1: Compress the image
        const compressedFile = await compressImage(file);
        
        // Step 2: Create preview URL
        const previewUrl = URL.createObjectURL(compressedFile);
        
        // Step 3: Get presigned URL for upload
        const presignedResponse = await fetch("/api/upload/presigned-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: compressedFile.name,
            contentType: compressedFile.type,
            type: "item",
            entityId: itemId,
          }),
        });

        if (!presignedResponse.ok) {
          const error = await presignedResponse.json();
          throw new Error(error.error || "Failed to get upload URL");
        }

        const { presignedUrl, s3Key } = await presignedResponse.json();

        // Step 4: Upload directly to S3
        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          body: compressedFile,
          headers: {
            "Content-Type": compressedFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to S3");
        }

        // Step 5: Set the selected image with S3 info
        onImageSelected({
          file: compressedFile,
          previewUrl,
          s3Key,
          s3Url: "", // Will be generated server-side when associating with remark
        });

        toast.success("Image prepared for upload");

      } catch (err) {
        console.error("Error processing image:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to process image";
        setError(errorMessage);
        toast.error(errorMessage);
        resetInput();
        onImageSelected(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [itemId, onImageSelected, resetInput]
  );

  const handleRemoveImage = useCallback(() => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    onImageSelected(null);
    resetInput();
    setError(null);
  }, [selectedImage, onImageSelected, resetInput]);

  const handleChangeImage = useCallback(() => {
    handleRemoveImage();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [handleRemoveImage]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="image-upload" className="text-sm font-medium">
          Attach Image (Optional)
        </Label>
        <p className="text-xs text-muted-foreground">
          Upload an image to accompany your remark
        </p>
      </div>

      {!selectedImage ? (
        <div className="relative">
          <Input
            id="image-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || isProcessing}
            className="hidden"
          />
          <Label
            htmlFor="image-upload"
            className={`
              flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
              transition-colors duration-200
              ${
                disabled || isProcessing
                  ? "border-muted bg-muted/20 cursor-not-allowed"
                  : "border-muted-foreground/25 bg-muted/10 hover:bg-muted/20 hover:border-muted-foreground/40"
              }
            `}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud
                className={`w-8 h-8 mb-2 ${
                  disabled || isProcessing 
                    ? "text-muted-foreground/50" 
                    : "text-muted-foreground"
                }`}
              />
              <p className="mb-1 text-sm text-muted-foreground">
                <span className="font-medium">
                  {isProcessing ? "Processing..." : "Click to upload"}
                </span>
                {!isProcessing && " or drag and drop"}
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </Label>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Image Preview */}
          <Dialog>
            <DialogTrigger asChild>
              <div className="relative group cursor-pointer">
                <div className="w-full h-48 border rounded-lg overflow-hidden bg-muted/10">
                  <img
                    src={selectedImage.previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/90 rounded-full p-2">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex items-center justify-center p-4">
              <img
                src={selectedImage.previewUrl}
                alt="Full size preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </DialogContent>
          </Dialog>

          {/* File Info and Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedImage.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedImage.file.size / 1024 / 1024).toFixed(2)} MB • Ready to save
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleChangeImage}
                disabled={disabled}
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Change Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveImage}
                disabled={disabled}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}