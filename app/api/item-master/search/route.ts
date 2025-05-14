import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Read searchParams from the request URL *before* initializing the client
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.toLowerCase();

  // Now create the client
  const supabase = await createClient();

  // Get user session from Supabase
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Fetch Profile to get Organization ID ---
  const userId = user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      `Error fetching profile or missing organization_id for user ${userId}:`,
      profileError?.message
    );
    // If profile doesn't exist or org ID is missing, treat as unauthorized/misconfigured
    return NextResponse.json(
      {
        error:
          profileError?.message ||
          "Unauthorized: User profile or organization mapping not found.",
      },
      { status: 401 } // Or 404, but 401 makes sense if org mapping is required
    );
  }
  const orgId = profile.organization_id;
  // --- End Profile Fetch ---

  if (!query) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    // Use orgId from Supabase session in the query
    const { data, error } = await supabase
      .from("item_master")
      .select("sku, master_details")
      .eq("organization_id", orgId)
      .ilike("sku", `%${query}%`)
      .limit(10);

    if (error) {
      console.error("Error searching item master:", error);
      throw new Error(error.message || "Database query failed");
    }

    const results = data.map((item) => ({
      value: item.sku,
      label: item.sku,
      master_details: item.master_details,
    }));

    return NextResponse.json(results, { status: 200 });
  } catch (error: unknown) {
    // Use unknown for catch
    console.error("Error in item master search API:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
