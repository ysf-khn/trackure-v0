import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface SampleImage {
  id: string;
  sample_id: string;
  s3_key?: string;
  s3_url?: string;
  image_url?: string; // For backward compatibility with legacy images
  file_name?: string;
  image_type: "general" | "front" | "back" | "side" | "top" | "bottom" | "detail" | "packaging";
  caption?: string;
  display_order: number;
  uploaded_at: string;
  uploaded_by: string;
  content_type?: string;
}

export function useSampleImages(sampleId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["sample-images", sampleId],
    queryFn: async (): Promise<SampleImage[]> => {
      const response = await fetch(`/api/samples/${sampleId}/images`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sample images");
      }
      return response.json();
    },
    enabled: enabled && !!sampleId,
  });
}

export function useUploadSampleImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sampleId: string;
      s3Key: string;
      s3Url: string;
      fileName: string;
      fileSizeBytes: number;
      contentType: string;
      imageType?: string;
      caption?: string;
      displayOrder?: number;
    }) => {
      const response = await fetch(`/api/samples/${data.sampleId}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          s3Key: data.s3Key,
          s3Url: data.s3Url,
          fileName: data.fileName,
          fileSizeBytes: data.fileSizeBytes,
          contentType: data.contentType,
          imageType: data.imageType || "general",
          caption: data.caption,
          displayOrder: data.displayOrder || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload sample image");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate sample images query
      queryClient.invalidateQueries({
        queryKey: ["sample-images", variables.sampleId],
      });
      toast.success("Sample image uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });
}

export function useDeleteSampleImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { sampleId: string; imageId: string }) => {
      const response = await fetch(
        `/api/samples/${data.sampleId}/images?imageId=${data.imageId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sample image");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate sample images query
      queryClient.invalidateQueries({
        queryKey: ["sample-images", variables.sampleId],
      });
      toast.success("Sample image deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}

// Helper function to get the display URL for a sample image
export function getSampleImageUrl(image: SampleImage): string | null {
  // Prefer S3 URL, fallback to legacy image_url
  return image.s3_url || image.image_url || null;
}

// Helper function to get the image type display name
export function getImageTypeLabel(type: SampleImage["image_type"]): string {
  const labels: Record<SampleImage["image_type"], string> = {
    general: "General",
    front: "Front View",
    back: "Back View", 
    side: "Side View",
    top: "Top View",
    bottom: "Bottom View",
    detail: "Detail Shot",
    packaging: "Packaging",
  };
  
  return labels[type] || "General";
}