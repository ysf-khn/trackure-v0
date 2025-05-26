import { useQuery } from "@tanstack/react-query";

interface UseCachedImageOptions {
  imageUrl?: string | null;
  enabled?: boolean;
}

export function useCachedImage({
  imageUrl,
  enabled = true,
}: UseCachedImageOptions) {
  return useQuery({
    queryKey: ["cached-image", imageUrl],
    queryFn: async () => {
      if (!imageUrl) return null;

      // Check if the image is already cached in browser
      const response = await fetch(imageUrl, {
        method: "HEAD", // Just check if image exists without downloading
      });

      if (response.ok) {
        return imageUrl;
      }

      throw new Error("Image not found");
    },
    enabled: enabled && !!imageUrl,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
