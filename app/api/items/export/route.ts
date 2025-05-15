import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";

// Define query parameter schema for validation
const querySchema = z.object({
  stageId: z.string().uuid().optional(),
  subStageId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  // Add dateRange parsing if needed later
  // startDate: z.string().datetime().optional(),
  // endDate: z.string().datetime().optional(),
});

// Define the structure of the data we want in the CSV
interface CsvItemData {
  item_id: string;
  order_id: string | null;
  order_number: string | null; // Assuming orders have a number
  current_stage_name: string | null;
  current_sub_stage_name: string | null;
  created_at: string;
  completed_at: string | null;
  // Add other relevant fields as needed
  // e.g., rework_count, last_moved_at etc.
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- RBAC Check: Only 'Owner' can export ---
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile or profile not found:", profileError);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }

  if (profile.role !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  const orgId = profile.organization_id;
  if (!orgId) {
    return NextResponse.json(
      { error: "User organization not found" },
      { status: 400 } // Or 500 if this state is unexpected
    );
  }

  // --- Parameter Validation ---
  const searchParams = request.nextUrl.searchParams;
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }
  const { stageId, subStageId, orderId } = parseResult.data;

  try {
    // --- Build Dynamic Query ---
    let query = supabase
      .from("items")
      .select(
        `
        id,
        order_id,
        orders ( order_number ),
        workflow_stages ( name ),
        workflow_sub_stages ( name ),
        created_at,
        completed_at
        `
        // Add more fields as needed
      )
      .eq("organization_id", orgId);

    if (stageId) {
      query = query.eq("current_stage_id", stageId);
    }
    if (subStageId) {
      // Ensure sub-stage filter is only applied if a stage filter is also present or makes sense contextually
      if (stageId) {
        query = query.eq("current_sub_stage_id", subStageId);
      } else {
        // Handle case where only subStageId is provided if necessary,
        // perhaps ignore it or return an error depending on requirements.
        console.warn(
          "SubStageId provided without StageId, ignoring sub-stage filter for export."
        );
      }
    }
    if (orderId) {
      query = query.eq("order_id", orderId);
    }

    // Add date range filters here if implemented

    query = query.order("created_at", { ascending: false }); // Example ordering

    const { data: items, error: dbError } = await query;

    if (dbError) {
      console.error("Database error fetching items for export:", dbError);
      throw dbError; // Let the catch block handle it
    }

    // --- Format Data for CSV ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedData: CsvItemData[] = (items || []).map((item: any) => ({
      // Use 'any' for simplicity or define a more precise type
      item_id: item.id,
      order_id: item.order_id,
      // Access nested data carefully, checking for nulls
      order_number: item.orders?.order_number ?? null,
      current_stage_name: item.workflow_stages?.name ?? null,
      current_sub_stage_name: item.workflow_sub_stages?.name ?? null,
      created_at: item.created_at,
      completed_at: item.completed_at,
      // Map other fields
    }));

    // --- Generate CSV ---
    if (formattedData.length === 0) {
      // Return an empty CSV or a message? Returning empty CSV is often preferred.
      const csv = Papa.unparse([]);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="trackure_export_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    const csv = Papa.unparse(formattedData, {
      header: true, // Include headers based on CsvItemData keys
    });

    // --- Return Response ---
    const filename = `trackure_export_${new Date().toISOString().split("T")[0]}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating CSV export:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to generate CSV export", details: message },
      { status: 500 }
    );
  }
}
