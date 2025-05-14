import { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./server"; // Assuming server client creator exists

// Define a basic Profile type - adjust based on your actual table structure
// It should at least include role and organization_id for our use case
export type UserProfile = {
  id: string; // Corresponds to auth.users.id
  role: "Owner" | "Worker" | string; // Be specific with roles if possible
  organization_id: string;
  // Add other profile fields as needed (e.g., full_name, avatar_url)
};

type UserWithProfile = {
  user: User | null;
  profile: UserProfile | null;
  error: Error | null; // Use Error type instead of any
};

/**
 * Fetches the current user session and their associated profile data.
 * To be used in Server Components or API Routes.
 * Assumes a 'profiles' table linked to 'auth.users' by ID,
 * containing 'role' and 'organization_id'.
 *
 * @param {SupabaseClient} [supabase] - Optional Supabase client instance. If not provided, creates one.
 * @returns {Promise<UserWithProfile>} - Object containing user, profile, and error.
 */
export async function getUserWithProfile(
  supabase?: SupabaseClient
): Promise<UserWithProfile> {
  // Ensure we have a resolved Supabase client instance
  const client = supabase || (await createClient()); // Await if creating a new one

  // 1. Get the user session
  const {
    data: { user },
    error: sessionError,
  } = await client.auth.getUser();

  if (sessionError || !user) {
    // Ensure sessionError is cast to Error if needed, or create a new one
    // Check if sessionError is truthy before accessing properties
    const errorMessage =
      sessionError &&
      typeof sessionError === "object" &&
      "message" in sessionError
        ? String(sessionError.message)
        : "User not found";
    const error =
      sessionError instanceof Error ? sessionError : new Error(errorMessage);
    return { user: null, profile: null, error };
  }

  // 2. Get the user's profile
  const { data: profileData, error: profileError } = await client
    .from("profiles") // Make sure 'profiles' is your actual table name
    .select("*") // Select all or specific columns: 'role, organization_id, ...'
    .eq("id", user.id)
    .single(); // Assuming one profile per user

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
    // Ensure profileError is cast to Error if needed
    // Check if profileError is truthy before accessing properties
    const errorMessage =
      profileError &&
      typeof profileError === "object" &&
      "message" in profileError
        ? String(profileError.message)
        : "Failed to fetch profile";
    const error =
      profileError instanceof Error ? profileError : new Error(errorMessage);
    return { user, profile: null, error };
  }

  // Basic check if profile data exists
  if (!profileData) {
    return { user, profile: null, error: new Error("User profile not found.") };
  }

  // TODO: Add validation here to ensure profileData matches UserProfile type if needed

  return { user, profile: profileData as UserProfile, error: null };
}

// Add other server-side query helpers here as needed...
