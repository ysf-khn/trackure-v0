"use client";

import { createClient } from "@/utils/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

export interface RemarkWithProfile {
  id: number;
  timestamp: string;
  text: string;
  item_id: string;
  user_id: string;
  created_by: string;
  full_name?: string; // Added to store actual user name from profiles table
}

// Type for the raw data returned by Supabase
interface RawRemarkData {
  id: number;
  timestamp: string;
  text: string;
  item_id: string;
  user_id: string;
}

async function fetchItemRemarks(
  supabase: SupabaseClient,
  itemId: string
): Promise<RemarkWithProfile[]> {
  // First, get the remarks
  const { data, error } = await supabase
    .from("remarks")
    .select(
      `
      id,
      timestamp,
      text,
      item_id,
      user_id
    `
    )
    .eq("item_id", itemId)
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Error fetching remarks:", error);
    throw new Error("Could not fetch item remarks");
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get unique user IDs from remarks
  const userIds = [...new Set(data.map((remark) => remark.user_id))].filter(
    (id): id is string => id !== null && id !== undefined
  );

  // Fetch profiles for those user IDs
  let profilesMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    } else if (profilesData) {
      profilesMap = Object.fromEntries(
        profilesData.map((profile) => [profile.id, profile.full_name])
      );
    }
  }

  // Process and combine the data
  const processedData = data.map((remark: RawRemarkData) => ({
    id: remark.id,
    timestamp: remark.timestamp,
    text: remark.text,
    item_id: remark.item_id,
    user_id: remark.user_id,
    created_by: remark.user_id,
    full_name: profilesMap[remark.user_id] || undefined, // Add full name from profiles
  }));

  return processedData;
}

export function useItemRemarks(itemId: string | null) {
  const supabase = createClient();

  return useQuery<RemarkWithProfile[], Error>({
    queryKey: ["itemRemarks", itemId],
    queryFn: () => {
      if (!itemId) {
        return Promise.resolve([]);
      }
      return fetchItemRemarks(supabase, itemId);
    },
    enabled: !!itemId,
    staleTime: 2 * 60 * 1000,
  });
}
