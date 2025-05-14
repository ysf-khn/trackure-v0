import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

const createStageSchema = z.object({
  name: z.string().min(1, "Stage name cannot be empty."),
  location: z.string().optional(), // Optional location field
  // sequence_order will be calculated on the server
});

export async function POST(request: Request) {
  // const cookieStore = cookies();
  const supabase = await createClient();

  try {
    // Use getUserWithProfile
    const {
      user,
      profile,
      error: userProfileError,
    } = await getUserWithProfile(supabase);

    if (userProfileError || !user || !profile) {
      return NextResponse.json(
        { error: userProfileError?.message || "Unauthorized" },
        { status: 401 }
      );
    }

    if (profile.role !== "Owner") {
      return NextResponse.json(
        { error: "Forbidden: Only Owners can add stages." },
        { status: 403 }
      );
    }

    const organization_id = profile.organization_id;

    const body = await request.json();
    const validation = createStageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, location } = validation.data;

    // Calculate next sequence_order
    const { data: maxOrderData, error: maxOrderError } = await supabase
      .from("workflow_stages")
      .select("sequence_order")
      .eq("organization_id", organization_id)
      .order("sequence_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxOrderError && maxOrderError.code !== "PGRST116") {
      console.error("Error fetching max sequence order:", maxOrderError);
      return NextResponse.json(
        { error: "Failed to determine stage order." },
        { status: 500 }
      );
    }

    const nextSequenceOrder = maxOrderData
      ? maxOrderData.sequence_order + 1
      : 0;

    // Insert new stage
    const { data: newStage, error: insertError } = await supabase
      .from("workflow_stages")
      .insert({
        name: name,
        location: location,
        sequence_order: nextSequenceOrder,
        organization_id: organization_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting stage:", insertError);
      // TODO: Handle potential unique constraint errors if needed
      return NextResponse.json(
        { error: "Failed to create stage." },
        { status: 500 }
      );
    }

    return NextResponse.json(newStage, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/settings/workflow/stages:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
