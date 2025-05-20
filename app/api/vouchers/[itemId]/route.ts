import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import PDFDocument from "pdfkit";

// Define body schema for validation
const bodySchema = z.object({
  quantity: z.number().int().positive(),
});

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

    // Fetch item data including current stage and history
    type ItemData = {
      id: string;
      sku: string | null;
      item_stage_allocations: {
        stage_id: string;
        sub_stage_id: string | null;
        workflow_stages: { name: string | null };
        workflow_sub_stages: { name: string | null };
      }[];
    };

    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select(
        `
        id,
        sku,
        item_stage_allocations!inner (
          stage_id,
          sub_stage_id,
          workflow_stages:stage_id (name),
          workflow_sub_stages:sub_stage_id (name)
        )
      `
      )
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .single<ItemData>();

    if (itemError || !itemData) {
      throw new Error("Failed to fetch item data");
    }

    // Get the current stage allocation
    const currentStage = itemData.item_stage_allocations[0];
    if (!currentStage) {
      throw new Error("No stage allocation found for item");
    }

    // Fetch the latest movement history to check if this is a rework
    const { data: movementHistory, error: movementError } = await supabase
      .from("item_movement_history")
      .select("rework_reason")
      .eq("item_id", itemId)
      .order("moved_at", { ascending: false })
      .limit(1)
      .single();

    if (movementError) {
      console.error("Error fetching movement history:", movementError);
    }

    const isRework = movementHistory?.rework_reason != null;
    const reworkReason = movementHistory?.rework_reason;

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
      .text(orgData.name + " Movement Voucher", { align: "center" })
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

    detailRow("Item SKU", itemData.sku || itemData.id);
    detailRow("Quantity", parseResult.data.quantity.toString());

    const locationText = `${currentStage.workflow_stages?.name || "Unknown Stage"}${
      currentStage.workflow_sub_stages?.name
        ? ` > ${currentStage.workflow_sub_stages.name}`
        : ""
    }`;
    detailRow("For", locationText);

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

    return new Promise<Response>((resolve) => {
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(
          new Response(pdfBuffer, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="movement_voucher_${
                itemData.sku || itemData.id
              }_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf"`,
            },
          })
        );
      });
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
