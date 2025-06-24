import { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  organizations: { name: string } | null;
};

interface UseProfileAndOrgReturn {
  user: User | null;
  organizationId: string | null;
  organizationName: string | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ProfileAndOrgData {
  user: User;
  profile: Profile;
}

// Query key factory
const profileAndOrgKeys = {
  all: ["profileAndOrg"] as const,
  current: () => [...profileAndOrgKeys.all, "current"] as const,
};

// Separate fetch function for React Query
const fetchProfileAndOrgData = async (): Promise<ProfileAndOrgData> => {
  const supabase = createClient();

  // Get current user
  const {
    data: { user: currentUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error("Authentication error: " + userError.message);
  if (!currentUser) throw new Error("No authenticated user found");

  // Fetch profile with organization data
  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*, organizations(name)")
    .eq("id", currentUser.id)
    .single();

  if (profileError)
    throw new Error("Failed to fetch profile: " + profileError.message);
  if (!data) throw new Error("Profile not found");

  return {
    user: currentUser,
    profile: data,
  };
};

export default function useProfileAndOrg(): UseProfileAndOrgReturn {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Use React Query for data fetching with proper caching
  const {
    data,
    isLoading,
    error: queryError,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: profileAndOrgKeys.current(),
    queryFn: fetchProfileAndOrgData,
    staleTime: 10 * 60 * 1000, // 10 minutes - profile data changes infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error?.message?.includes("Authentication error")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Set up auth state change listener with proper invalidation
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only invalidate on meaningful auth state changes
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        // Use invalidateQueries instead of direct refetch for better performance
        queryClient.invalidateQueries({
          queryKey: profileAndOrgKeys.all,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, supabase.auth]);

  // Manual refetch function for compatibility
  const refetch = async () => {
    await queryRefetch();
  };

  return {
    user: data?.user || null,
    organizationId: data?.profile?.organization_id || null,
    organizationName: data?.profile?.organizations?.name || null,
    profile: data?.profile || null,
    isLoading,
    error: queryError?.message || null,
    refetch,
  };
}
