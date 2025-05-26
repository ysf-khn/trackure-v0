import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import PDFDocument from "pdfkit";

// Define body schema for validation
const bodySchema = z.object({
  quantity: z.number().int().positive(),
  targetStageId: z.string().uuid().optional(),
  targetSubStageId: z.string().uuid().optional().nullable(),
  isRework: z.boolean().optional().default(false),
  reworkReason: z.string().optional().nullable(),
});

// GET method for downloading vouchers based on movement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get("history_id");

  if (!historyId) {
    return NextResponse.json(
      { error: "history_id parameter is required for GET requests" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- RBAC Check: Only 'Owner' can generate vouchers ---
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
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
      { status: 400 }
    );
  }

  try {
    // Fetch organization name
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    if (orgError || !orgData) {
      throw new Error("Failed to fetch organization data");
    }

    // Fetch item data (just basic info)
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id, sku")
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .single();

    if (itemError || !itemData) {
      throw new Error("Failed to fetch item data");
    }

    // Fetch the specific movement history record
    type MovementHistoryData = {
      id: number;
      quantity: number;
      rework_reason: string | null;
      to_stage: { name: string | null; location: string | null } | null;
      to_sub_stage: { name: string | null; location: string | null } | null;
    };

    const { data: movementHistory, error: movementError } = await supabase
      .from("item_movement_history")
      .select(
        `
        id,
        quantity,
        rework_reason,
        to_stage:workflow_stages!to_stage_id (name, location),
        to_sub_stage:workflow_sub_stages!to_sub_stage_id (name, location)
      `
      )
      .eq("id", historyId)
      .eq("item_id", itemId)
      .eq("organization_id", orgId)
      .single<MovementHistoryData>();

    if (movementError || !movementHistory) {
      throw new Error("Movement history record not found or access denied");
    }

    const isRework = movementHistory.rework_reason != null;
    const reworkReason = movementHistory.rework_reason;

    // Get target stage information
    const targetStage = movementHistory.to_stage;
    const targetSubStage = movementHistory.to_sub_stage;

    if (!targetStage) {
      throw new Error("Target stage information not found in movement history");
    }

    const pdfBuffer = await generateVoucherPDF({
      orgName: orgData.name,
      itemSku: itemData.sku || itemData.id,
      quantity: movementHistory.quantity,
      targetStage,
      targetSubStage,
      isRework,
      reworkReason,
    });

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="movement_voucher_${
          itemData.sku || itemData.id
        }_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating voucher:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to generate voucher", details: message },
      { status: 500 }
    );
  }
}

// POST method for generating vouchers during movement operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- RBAC Check: Only 'Owner' can generate vouchers ---
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
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
      { status: 400 }
    );
  }

  // --- Body Validation ---
  const body = await request.json();
  const parseResult = bodySchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    // Fetch organization name
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    if (orgError || !orgData) {
      throw new Error("Failed to fetch organization data");
    }

    // Fetch item data (just basic info)
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id, sku")
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .single();

    if (itemError || !itemData) {
      throw new Error("Failed to fetch item data");
    }

    let targetStage: { name: string | null; location: string | null } | null =
      null;
    let targetSubStage: {
      name: string | null;
      location: string | null;
    } | null = null;
    let isRework = parseResult.data.isRework;
    let reworkReason = parseResult.data.reworkReason || null;

    // If target stage information is provided in the request, use it
    if (parseResult.data.targetStageId) {
      // First, try to fetch as a main stage
      const { data: stageData, error: stageError } = await supabase
        .from("workflow_stages")
        .select("name, location")
        .eq("id", parseResult.data.targetStageId)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (stageData) {
        // It's a main stage
        targetStage = stageData;

        // Fetch target sub-stage information if provided
        if (parseResult.data.targetSubStageId) {
          const { data: subStageData, error: subStageError } = await supabase
            .from("workflow_sub_stages")
            .select("name, location")
            .eq("id", parseResult.data.targetSubStageId)
            .eq("stage_id", parseResult.data.targetStageId)
            .single();

          if (subStageError) {
            console.warn(
              "Failed to fetch target sub-stage information:",
              subStageError
            );
            // Don't throw error, just continue without sub-stage info
          } else {
            targetSubStage = subStageData;
          }
        }
      } else {
        // It might be a sub-stage ID, try to fetch as sub-stage
        const { data: subStageData, error: subStageError } = await supabase
          .from("workflow_sub_stages")
          .select(
            `
            name, 
            location,
            workflow_stages!stage_id (name, location)
          `
          )
          .eq("id", parseResult.data.targetStageId)
          .maybeSingle();

        if (subStageData && subStageData.workflow_stages) {
          // It's a sub-stage
          const stageInfo = Array.isArray(subStageData.workflow_stages)
            ? subStageData.workflow_stages[0]
            : subStageData.workflow_stages;
          targetStage = stageInfo as {
            name: string | null;
            location: string | null;
          };
          targetSubStage = {
            name: subStageData.name,
            location: subStageData.location,
          };
        } else {
          throw new Error(
            "Failed to fetch target stage information - stage not found"
          );
        }
      }
    } else {
      // Fall back to fetching from latest movement history
      type MovementHistoryData = {
        id: number;
        rework_reason: string | null;
        to_stage: { name: string | null; location: string | null } | null;
        to_sub_stage: { name: string | null; location: string | null } | null;
      };

      const { data: movementHistory, error: movementError } = await supabase
        .from("item_movement_history")
        .select(
          `
          id,
          rework_reason,
          to_stage:workflow_stages!to_stage_id (name, location),
          to_sub_stage:workflow_sub_stages!to_sub_stage_id (name, location)
        `
        )
        .eq("item_id", itemId)
        .order("moved_at", { ascending: false })
        .limit(1)
        .single<MovementHistoryData>();

      if (movementError || !movementHistory) {
        throw new Error(
          "Failed to fetch movement history and no target stage provided"
        );
      }

      isRework = movementHistory.rework_reason != null;
      reworkReason = movementHistory.rework_reason;
      targetStage = movementHistory.to_stage;
      targetSubStage = movementHistory.to_sub_stage;
    }

    if (!targetStage) {
      throw new Error("Target stage information not found");
    }

    const pdfBuffer = await generateVoucherPDF({
      orgName: orgData.name,
      itemSku: itemData.sku || itemData.id,
      quantity: parseResult.data.quantity,
      targetStage,
      targetSubStage,
      isRework,
      reworkReason,
    });

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="movement_voucher_${
          itemData.sku || itemData.id
        }_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating voucher:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to generate voucher", details: message },
      { status: 500 }
    );
  }
}

// Helper function to generate the PDF voucher
async function generateVoucherPDF({
  orgName,
  itemSku,
  quantity,
  targetStage,
  targetSubStage,
  isRework,
  reworkReason,
}: {
  orgName: string;
  itemSku: string;
  quantity: number;
  targetStage: { name: string | null; location: string | null };
  targetSubStage: { name: string | null; location: string | null } | null;
  isRework: boolean;
  reworkReason: string | null;
}): Promise<Buffer> {
  // Create PDF document with built-in fonts only
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];

  doc.on("data", buffers.push.bind(buffers));

  // Define colors
  const primaryColor = "#2c3e50";
  const secondaryColor = "#7f8c8d";
  const reworkColor = "#e74c3c";

  // Header
  doc
    .fillColor(primaryColor)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(orgName + " Movement Voucher", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(12)
    .fillColor(secondaryColor)
    .text(`Generated on ${format(new Date(), "PPpp")}`, {
      align: "center",
    })
    .moveDown();

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor("#bdc3c7")
    .lineWidth(1)
    .stroke()
    .moveDown(1.5);

  // Details Section
  doc.font("Helvetica").fontSize(12).fillColor("black");

  const detailRow = (label: string, value: string) => {
    doc
      .font("Helvetica-Bold")
      .text(`${label}:`, { continued: true })
      .font("Helvetica")
      .text(` ${value}`)
      .moveDown(0.5);
  };

  detailRow("Item SKU", itemSku);
  detailRow("Quantity", quantity.toString());

  // Build target stage text with location
  const targetStageText = `${targetStage.name || "Unknown Stage"}${
    targetSubStage?.name ? ` > ${targetSubStage.name}` : ""
  }`;
  detailRow("Target Stage", targetStageText);

  // Add location information if available
  const targetLocation = targetSubStage?.location || targetStage.location;
  if (targetLocation) {
    detailRow("Stage Location", targetLocation);
  }

  // Add rework information if this is a rework movement
  if (isRework && reworkReason) {
    doc.moveDown(0.5);
    doc
      .font("Helvetica-Bold")
      .fillColor(reworkColor)
      .text("Rework Details", { underline: true })
      .moveDown(0.5);

    doc
      .font("Helvetica")
      .fillColor(reworkColor)
      .text(`Reason: ${reworkReason}`)
      .moveDown(0.5);
  }

  // Add a bottom note or signature line if needed
  doc.moveDown(2);
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .fillColor(secondaryColor)
    .text("This is a system-generated voucher from Trakure", {
      align: "center",
    });
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .fillColor(secondaryColor)
    .text("trakure.com", { align: "center" });

  // Finalize PDF
  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
  });
}
