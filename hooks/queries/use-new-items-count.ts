"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

const fetchNewItemsCount = async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  // Fetch the organization_id for the current user
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      "Error fetching profile or organization_id for new items count:",
      profileError
    );
    return 0; // Or throw an error, depending on desired behavior
  }

  // Query the new_order_items view for items belonging to the user's organization
  // and count them. The view already filters by status = 'New'.
  const { count, error } = await supabase
    .from("new_order_items")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error fetching new items count:", error);
    // Consider throwing the error or returning a specific error state
    return 0; // Fallback to 0 on error
  }

  return count ?? 0;
};

export function useNewItemsCount() {
  return useQuery<number, Error>({
    queryKey: ["newItemsCount"],
    queryFn: fetchNewItemsCount,
    // Optional: configure staleTime, cacheTime, refetchInterval, etc.
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
