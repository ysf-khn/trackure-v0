import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
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

    // Get unique SKUs - just get sku for now since item_name column might not exist
    const { data: skus, error: skusError } = await supabase
      .from("item_master")
      .select("sku")
      .eq("organization_id", profile.organization_id)
      .order("sku");

    if (skusError) {
      console.error("Error fetching SKUs:", skusError);
      return NextResponse.json({ error: "Failed to fetch SKUs" }, { status: 500 });
    }

    // Remove duplicates and format data
    const uniqueSKUs = Array.from(
      new Map(skus?.map(item => [item.sku, item]) || []).values()
    );

    return NextResponse.json({
      skus: uniqueSKUs.map(sku => ({
        sku: sku.sku,
        sku_name: sku.sku, // Use SKU as name for now
      }))
    });

  } catch (error) {
    console.error("Error in SKUs API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}