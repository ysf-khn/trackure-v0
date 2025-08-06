import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> }
) {
  try {
    const supabase = await createClient();
    const { sampleId } = await params;

    // Get the current user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify sample belongs to organization
    const { data: sample } = await supabase
      .from("samples")
      .select("id")
      .eq("id", sampleId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!sample) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }

    // Get change history
    const { data: history, error: historyError } = await supabase
      .from("sample_change_history")
      .select(`
        id,
        change_type,
        field_name,
        old_value,
        new_value,
        changed_at,
        changed_by
      `)
      .eq("sample_id", sampleId)
      .order("changed_at", { ascending: false });

    if (historyError) {
      console.error("Error fetching sample history:", historyError);
      return NextResponse.json({ error: "Failed to fetch sample history" }, { status: 500 });
    }

    if (!history || history.length === 0) {
      return NextResponse.json({ history: [] });
    }

    // Get unique user IDs from history
    const userIds = [...new Set(history.map(h => h.changed_by).filter(Boolean))];
    
    // Fetch user profiles if there are any user IDs
    let userProfiles: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      
      if (profiles) {
        userProfiles = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile.full_name || 'Unknown User';
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Format the history entries
    const formattedHistory = history.map((entry) => ({
      id: entry.id,
      change_type: entry.change_type,
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      changed_at: entry.changed_at,
      changed_by: entry.changed_by,
      changed_by_name: entry.changed_by ? (userProfiles[entry.changed_by] || 'Unknown User') : 'System'
    }));

    return NextResponse.json({ history: formattedHistory });

  } catch (error) {
    console.error("Error in sample history API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}