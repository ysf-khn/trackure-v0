"use client";

import React, { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UploadCloud, X, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/lib/image-utils";

interface ImageUploaderProps {
  itemId: string;
  organizationId: string;
  remarkId?: string; // Optional: to link image to a specific remark
  onUploadComplete?: (imageData: {
    storagePath: string;
    fileName?: string;
  }) => void;
  bucketName?: string;
  disabled?: boolean;
}

const BUCKET_NAME = "item-images";

export function ImageUploader({
  itemId,
  organizationId,
  remarkId,
  onUploadComplete,
  bucketName = BUCKET_NAME,
  disabled = false,
}: ImageUploaderProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsCompressing(false);
    setIsUploading(false);
    setUploadProgress(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear file input
    }
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = event.target.files?.[0];
      if (file) {
        if (!file.type.startsWith("image/")) {
          setError("Please select an image file.");
          resetState();
          return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        resetState();
      }
    },
    [resetState]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !itemId || !organizationId) {
      setError(
        "Missing required information (file, item ID, or organization ID)."
      );
      return;
    }

    setError(null);
    setIsCompressing(true);
    setUploadProgress(null);

    let fileToUpload: File;
    try {
      fileToUpload = await compressImage(selectedFile);
    } catch (compError) {
      console.error("Compression Error:", compError);
      setError(`Failed to compress image: ${(compError as Error).message}`);
      setIsCompressing(false);
      return;
    }
    setIsCompressing(false);
    setIsUploading(true);

    const fileExt = fileToUpload.name.split(".").pop();
    const timestamp = Date.now();
    const filePath = `${organizationId}/${itemId}/${timestamp}_${fileToUpload.name.replace(/\.[^/.]+$/, "").slice(0, 50)}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
          // Track progress - may need adjustments based on Supabase client version
          // This part is often handled differently or might not be directly available
          // progress: (event) => {
          //   if (event.lengthComputable) {
          //     setUploadProgress(Math.round((event.loaded / event.total) * 100));
          //   }
          // },
        });

      if (uploadError) {
        console.log("Storage upload failed:", uploadError);
        throw uploadError;
      }

      // Associate image with item via API
      const response = await fetch(`/api/items/${itemId}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storagePath: filePath,
          fileName: fileToUpload.name,
          fileSizeBytes: fileToUpload.size,
          contentType: fileToUpload.type,
          remarkId: remarkId, // Include remarkId if provided
        }),
      });

      if (!response.ok) {
        const apiError = await response.json();
        throw new Error(
          apiError.error || "Failed to associate image with item."
        );
      }

      toast.success("Upload Successful", {
        description: `Image "${fileToUpload.name}" uploaded and linked.`,
      });
      onUploadComplete?.({
        storagePath: filePath,
        fileName: fileToUpload.name,
      });
      resetState(); // Clear state after successful upload
    } catch (err) {
      console.error("Upload or API Error:", err);

      let errorMessage = "An unexpected error occurred during upload.";
      // Check for API error structure first { error: ... }
      if (typeof err === "object" && err !== null && "error" in err) {
        const apiError = err.error; // Extract the nested error
        if (Array.isArray(apiError)) {
          // Likely Zod error array from our API
          errorMessage = apiError
            .map((e) => `${e.path?.join(".")} ${e.message}`)
            .join(", ");
        } else {
          errorMessage = String(apiError); // Convert other nested errors to string
        }
      } else if (err instanceof Error) {
        // Standard Error object
        errorMessage = err.message;
      } else if (typeof err === "string") {
        // Simple string error
        errorMessage = err;
      }

      setError(`Upload failed: ${errorMessage}`);
      toast.error("Upload Failed", {
        description: errorMessage,
      });
      // Optional: Attempt to delete the file from storage if API call failed?
    } finally {
      setIsUploading(false);
      setUploadProgress(null); // Ensure progress is cleared
    }
  }, [
    selectedFile,
    itemId,
    organizationId,
    remarkId,
    supabase.storage,
    bucketName,
    onUploadComplete,
    resetState,
  ]);

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

      {!previewUrl ? (
        <div className="relative">
          <Input
            id="image-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || isUploading || isCompressing}
            className="hidden"
          />
          <Label
            htmlFor="image-upload"
            className={`
              flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
              transition-colors duration-200
              ${
                disabled || isUploading || isCompressing
                  ? "border-muted bg-muted/20 cursor-not-allowed"
                  : "border-muted-foreground/25 bg-muted/10 hover:bg-muted/20 hover:border-muted-foreground/40"
              }
            `}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud
                className={`w-8 h-8 mb-2 ${disabled || isUploading || isCompressing ? "text-muted-foreground/50" : "text-muted-foreground"}`}
              />
              <p className="mb-1 text-sm text-muted-foreground">
                <span className="font-medium">Click to upload</span> or drag and
                drop
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </Label>
        </div>
      ) : (
        <div className="space-y-3">
          <Dialog>
            <DialogTrigger asChild>
              <div className="relative group cursor-pointer">
                <div className="w-full h-48 border rounded-lg overflow-hidden bg-muted/10">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/90 rounded-full p-2">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetState();
                  }}
                  disabled={disabled || isUploading || isCompressing}
                  aria-label="Remove selected image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt="Full size preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </DialogContent>
          </Dialog>

          {selectedFile && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>

              {(isCompressing || isUploading) && (
                <div className="space-y-2">
                  <Progress
                    value={isCompressing ? undefined : (uploadProgress ?? 0)}
                    className="w-full h-2"
                  />
                  <p className="text-sm text-primary text-center">
                    {isCompressing
                      ? "Compressing image..."
                      : `Uploading ${uploadProgress !== null ? `${uploadProgress}%` : "..."}`}
                  </p>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={disabled || isUploading || isCompressing}
                className="w-full"
                size="sm"
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                {isUploading
                  ? "Uploading..."
                  : isCompressing
                    ? "Compressing..."
                    : "Upload Image"}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
