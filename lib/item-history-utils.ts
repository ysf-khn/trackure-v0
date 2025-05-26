import { createClient } from "@/utils/supabase/server";

export type ItemHistoryEntry = {
  id: number;
  moved_at: string;
  rework_reason: string | null;
  from_stage_name: string | null;
  from_sub_stage_name: string | null;
  to_stage_name: string | null;
  to_sub_stage_name: string | null;
  quantity: number;
  user_full_name: string | null;
};

// Movement history data type
type MovementData = {
  id: number;
  moved_at: string;
  rework_reason: string | null;
  moved_by: string | null;
  quantity: number;
  from_stage: { name: string } | null;
  from_sub_stage: { name: string } | null;
  to_stage: { name: string } | null;
  to_sub_stage: { name: string } | null;
};

// Function to fetch all history for PDF export (with optional date range)
export async function fetchAllItemHistory(
  itemId: string,
  dateFrom?: Date,
  dateTo?: Date,
  maxRecords?: number
): Promise<ItemHistoryEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from("item_movement_history")
    .select(
      `
      id,
      moved_at,
      rework_reason,
      moved_by,
      quantity,
      from_stage:workflow_stages!from_stage_id(name),
      from_sub_stage:workflow_sub_stages!from_sub_stage_id(name),
      to_stage:workflow_stages!to_stage_id(name),
      to_sub_stage:workflow_sub_stages!to_sub_stage_id(name)
    `
    )
    .eq("item_id", itemId)
    .order("moved_at", { ascending: false });

  // Apply date filters if provided
  if (dateFrom) {
    query = query.gte("moved_at", dateFrom.toISOString());
  }
  if (dateTo) {
    query = query.lte("moved_at", dateTo.toISOString());
  }

  // Apply limit if provided
  if (maxRecords) {
    query = query.limit(maxRecords);
  }

  const { data: movementData, error: movementError } =
    await query.returns<MovementData[]>();

  if (movementError) {
    console.error("Error fetching all item movement history:", movementError);
    throw movementError;
  }

  // Get profiles for moved_by users
  const movedByUsers = movementData
    ?.map((entry) => entry.moved_by)
    .filter((id): id is string => id !== null);

  let profilesMap: Record<string, string> = {};

  if (movedByUsers && movedByUsers.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", movedByUsers);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    } else if (profilesData) {
      profilesMap = Object.fromEntries(
        profilesData.map((profile) => [profile.id, profile.full_name])
      );
    }
  }

  // Combine the data
  return (movementData || []).map((entry) => ({
    id: entry.id,
    moved_at: entry.moved_at,
    rework_reason: entry.rework_reason,
    from_stage_name: entry.from_stage?.name ?? null,
    from_sub_stage_name: entry.from_sub_stage?.name ?? null,
    to_stage_name: entry.to_stage?.name ?? "N/A",
    to_sub_stage_name: entry.to_sub_stage?.name ?? null,
    quantity: entry.quantity,
    user_full_name:
      (entry.moved_by ? profilesMap[entry.moved_by] : null) ??
      (entry.moved_by ? "Unknown User" : "System"),
  }));
}
