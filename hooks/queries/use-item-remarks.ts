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

  // Process the data
  const processedData = (data || []).map((remark: RawRemarkData) => ({
    id: remark.id,
    timestamp: remark.timestamp,
    text: remark.text,
    item_id: remark.item_id,
    user_id: remark.user_id,
    created_by: remark.user_id,
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
