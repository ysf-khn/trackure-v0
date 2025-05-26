import { useState, useEffect, useCallback, useMemo } from "react";
import { imageCache } from "@/lib/image-cache";

interface UseAvatarUrlOptions {
  rawAvatarUrl?: string | null;
  userId?: string;
}

export function useAvatarUrl({ rawAvatarUrl, userId }: UseAvatarUrlOptions) {
  // Store the cache bust timestamp in state, only update when avatar changes
  const [cacheBustTimestamp, setCacheBustTimestamp] = useState<number | null>(
    null
  );

  // Helper function to convert Supabase URL to proxy URL
  const getProxyImageUrl = useCallback((url: string | null) => {
    if (!url) return null;

    // If it's a Supabase storage URL, convert to proxy URL
    if (url.includes("supabase.co/storage/v1/object/public/profile-images/")) {
      const fileName = url.split("/profile-images/")[1];
      return `/api/images/${fileName}`;
    }

    return url;
  }, []);

  // Convert raw URL to proxy URL
  const proxyUrl = getProxyImageUrl(rawAvatarUrl || null);

  // Create final URL with cache busting only when needed
  const avatarUrl = useMemo(() => {
    if (!proxyUrl || !userId) return proxyUrl;

    // Check cache first
    const cacheKey = imageCache.getUserAvatarKey(userId);
    const cachedUrl = imageCache.get(cacheKey);

    if (cachedUrl && !cacheBustTimestamp) {
      return cachedUrl;
    }

    // Create URL with cache busting if needed
    const finalUrl = cacheBustTimestamp
      ? `${proxyUrl}?t=${cacheBustTimestamp}`
      : proxyUrl;

    // Cache the URL
    if (finalUrl) {
      imageCache.set(cacheKey, finalUrl);
    }

    return finalUrl;
  }, [proxyUrl, userId, cacheBustTimestamp]);

  // Function to invalidate cache (call this when avatar is updated)
  const invalidateCache = useCallback(() => {
    if (userId) {
      const cacheKey = imageCache.getUserAvatarKey(userId);
      imageCache.invalidate(cacheKey);
    }
    setCacheBustTimestamp(Date.now());
  }, [userId]);

  // Reset cache bust when user changes (in case of user switching)
  useEffect(() => {
    setCacheBustTimestamp(null);
  }, [userId]);

  return {
    avatarUrl,
    invalidateCache,
    proxyUrl, // URL without cache busting for cases where it's not needed
  };
}
