"use client";

import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

// Define the structure of the image data returned by the API
export interface ItemImage {
  id: string;
  storage_path: string;
  file_name: string | null;
  uploaded_at: string;
  uploaded_by: string; // User UUID
  remark_id: number | null; // BIGINT of the remark it's linked to (remarks.id is bigserial/BIGINT)
  content_type: string | null;
}

// Function to fetch images for a specific item
async function fetchItemImages(
  supabase: SupabaseClient,
  itemId: string
): Promise<ItemImage[]> {
  const response = await fetch(`/api/items/${itemId}/images`);

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Error fetching item images:", errorData);
    throw new Error(errorData.error || "Could not fetch item images");
  }

  const images = await response.json();
  return images as ItemImage[];
}

// Custom hook to use the fetch function with TanStack Query
export function useItemImages(itemId: string | null) {
  // It's generally recommended to use the specific client creation functions
  // depending on context (client component, server component, route handler).
  // createClientComponentClient is suitable for client components.
  const supabase = createClient();

  return useQuery<ItemImage[], Error>({
    queryKey: ["itemImages", itemId], // Query key includes the item ID
    queryFn: () => {
      if (!itemId) {
        // If no itemId, return empty array immediately
        return Promise.resolve([]);
      }
      // Supabase client instance isn't strictly needed for fetch API call,
      // but passed in case fetchItemImages needed it later.
      return fetchItemImages(supabase, itemId);
    },
    enabled: !!itemId, // Only run the query if itemId is provided
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    refetchOnWindowFocus: true,
  });
}
