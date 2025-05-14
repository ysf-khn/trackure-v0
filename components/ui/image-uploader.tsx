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
    console.log(organizationId);
    const filePath = `${organizationId}/${itemId}/${timestamp}_${fileToUpload.name.replace(/\.[^/.]+$/, "").slice(0, 50)}.${fileExt}`;

    try {
      console.log("compressed");
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
    <div className="space-y-4 p-4 border rounded-md bg-card text-card-foreground">
      <Label htmlFor="image-upload" className="font-medium">
        Upload Image
      </Label>
      <Input
        id="image-upload"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || isUploading || isCompressing}
        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
      />

      {previewUrl && selectedFile && (
        <Dialog>
          <DialogTrigger asChild>
            <div
              className="mt-4 p-2 border rounded-md relative w-40 h-40 flex items-center justify-center bg-muted/40 cursor-pointer group"
              role="button"
              aria-label="View full size image"
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 bg-background/70 hover:bg-destructive hover:text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
          <DialogContent className="max-w-3xl max-h-[85vh] flex items-center justify-center p-2 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Full size preview"
              className="max-w-full max-h-[80vh] object-contain rounded-md"
            />
          </DialogContent>
        </Dialog>
      )}
      {!previewUrl && (
        <div className="mt-4 p-2 border rounded-md w-40 h-40 flex flex-col items-center justify-center bg-muted/40 text-muted-foreground">
          <ImageIcon className="h-10 w-10 mb-2" />
          <span className="text-sm text-center">Select an image</span>
        </div>
      )}

      {selectedFile && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground truncate">
            Selected: {selectedFile.name} (
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>

          {(isCompressing || isUploading) && (
            <Progress
              value={isCompressing ? undefined : (uploadProgress ?? 0)}
              className="w-full h-2"
            />
          )}
          {isCompressing && (
            <p className="text-sm text-primary animate-pulse">Compressing...</p>
          )}
          {isUploading && (
            <p className="text-sm text-primary animate-pulse">
              Uploading {uploadProgress !== null ? `${uploadProgress}%` : "..."}
            </p>
          )}

          <Button
            onClick={handleUpload}
            disabled={disabled || isUploading || isCompressing}
            className="w-full"
            aria-label="Upload selected image"
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

      {error && <p className="mt-2 text-sm text-destructive">Error: {error}</p>}
    </div>
  );
}
