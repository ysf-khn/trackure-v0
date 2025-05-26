import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

const fetchCompletedItemsCount = async (): Promise<number> => {
  const supabase = createClient();

  // Get the current user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw new Error("User organization not found");
  }

  // Count items with status = 'Completed' in the user's organization
  const { count, error } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id)
    .eq("status", "Completed");

  if (error) {
    throw new Error(`Failed to fetch completed items count: ${error.message}`);
  }

  return count || 0;
};

export const useCompletedItemsCount = () => {
  return useQuery<number, Error>({
    queryKey: ["completedItemsCount"],
    queryFn: fetchCompletedItemsCount,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
  });
};
