import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";

const subStageSchema = z.object({
  name: z.string().min(1, "Sub-stage name cannot be empty."),
  location: z.string().optional(),
});

const createStageSchema = z
  .object({
    name: z.string().min(1, "Stage name cannot be empty."),
    location: z.string().optional(), // Optional location field
    hasSubStages: z.boolean().optional(),
    subStages: z.array(subStageSchema).optional(),
    // sequence_order will be calculated on the server
  })
  .refine(
    (data) => {
      // If hasSubStages is true, must have at least one sub-stage
      if (data.hasSubStages) {
        return data.subStages && data.subStages.length > 0;
      }
      return true;
    },
    {
      message: "At least one sub-stage is required when sub-stages are enabled",
    }
  );

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

    const { name, location, hasSubStages, subStages } = validation.data;

    // Calculate next sequence_order using simple max + 1 logic
    // Completed stages now use sequence order 100000, so they won't interfere
    const { data: maxOrderData, error: maxOrderError } = await supabase
      .from("workflow_stages")
      .select("sequence_order")
      .eq("organization_id", organization_id)
      .lt("sequence_order", 50000) // Only consider stages with reasonable sequence orders
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
      return NextResponse.json(
        { error: "Failed to create stage." },
        { status: 500 }
      );
    }

    // If sub-stages are provided, create them
    if (hasSubStages && subStages && subStages.length > 0) {
      const subStageInserts = subStages.map((subStage, index) => ({
        name: subStage.name,
        location: subStage.location,
        sequence_order: index + 1,
        stage_id: newStage.id,
        organization_id: organization_id,
      }));

      const { error: subStageError } = await supabase
        .from("workflow_sub_stages")
        .insert(subStageInserts);

      if (subStageError) {
        console.error("Error inserting sub-stages:", subStageError);
        // Clean up the stage if sub-stage creation fails
        await supabase.from("workflow_stages").delete().eq("id", newStage.id);

        return NextResponse.json(
          { error: "Failed to create sub-stages." },
          { status: 500 }
        );
      }
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
