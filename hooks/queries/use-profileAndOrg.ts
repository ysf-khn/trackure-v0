import { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

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

export default function useProfileAndOrg(): UseProfileAndOrgReturn {
  const [user, setUser] = useState<User | null>(null); // Add user state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchProfileAndOrgData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError)
        throw new Error("Authentication error: " + userError.message);
      if (!currentUser) throw new Error("No authenticated user found");

      // Store the user in state
      setUser(currentUser);

      // Fetch profile with organization data
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*, organizations(name)")
        .eq("id", currentUser.id)
        .single();

      if (profileError)
        throw new Error("Failed to fetch profile: " + profileError.message);
      if (!data) throw new Error("Profile not found");

      setProfile(data);
    } catch (e) {
      console.error("Error fetching organization data:", e);
      setError(e instanceof Error ? e.message : "An unknown error occurred");
      setUser(null); // Reset user on error
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndOrgData();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchProfileAndOrgData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    organizationId: profile?.organization_id || null,
    organizationName: profile?.organizations?.name || null,
    profile,
    isLoading,
    error,
    refetch: fetchProfileAndOrgData,
  };
}
