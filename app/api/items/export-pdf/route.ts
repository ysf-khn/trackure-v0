import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { format } from "date-fns";

// Define query parameter schema for validation
const querySchema = z.object({
  stageId: z.string().uuid().optional(),
  subStageId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Define the structure of the data we want in the PDF
interface PdfItemData {
  item_id: string;
  sku: string | null;
  order_id: string | null;
  order_number: string | null;
  quantity: number;
  current_stage_entered_at: string | null;
  instance_details: Record<string, unknown> | null;
  stage_id: string;
  sub_stage_id: string | null;
}

interface HistoryMovementEntry {
  id: number;
  moved_at: string;
  to_stage_id: string;
  to_sub_stage_id: string | null;
}

interface ItemDetails {
  id: string;
  sku: string;
  order_id: string;
  orders: {
    order_number: string | null;
  };
  instance_details: Record<string, unknown>;
  item_movement_history: HistoryMovementEntry[];
}

interface ItemAllocation {
  stage_id: string;
  sub_stage_id: string | null;
  quantity: number;
  items: ItemDetails | ItemDetails[];
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

  // Get user profile and organization
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role, full_name")
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
      { status: 400 }
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
  const { stageId, subStageId, orderId, startDate, endDate } = parseResult.data;

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

    // Fetch workflow stages and sub-stages for name resolution
    const { data: workflowStages, error: workflowError } = await supabase
      .from("workflow_stages")
      .select(
        `
        id,
        name,
        workflow_sub_stages (
          id,
          name
        )
      `
      )
      .eq("organization_id", orgId);

    if (workflowError) {
      console.error("Error fetching workflow stages:", workflowError);
      throw new Error("Failed to fetch workflow data");
    }

    // Create lookup maps for stage and sub-stage names
    const stageNameMap = new Map<string, string>();
    const subStageNameMap = new Map<string, string>();

    workflowStages?.forEach((stage) => {
      stageNameMap.set(stage.id, stage.name || "Unknown Stage");
      stage.workflow_sub_stages?.forEach((subStage) => {
        subStageNameMap.set(subStage.id, subStage.name || "Unknown Sub-Stage");
      });
    });

    // --- Build Dynamic Query using the same approach as useItemsInStage ---
    let query = supabase
      .from("item_stage_allocations")
      .select(
        `
        stage_id,
        sub_stage_id,
        quantity, 
        items:items!inner (
          id,
          sku,
          order_id,
          orders:orders!inner (
            order_number
          ),
          instance_details,
          item_movement_history (
            id,
            moved_at,
            to_stage_id,
            to_sub_stage_id
          )
        )
      `
      )
      .eq("organization_id", orgId);

    if (stageId) {
      query = query.eq("stage_id", stageId);
    }
    if (subStageId) {
      query = query.eq("sub_stage_id", subStageId);
    } else if (stageId) {
      // Only apply null filter if we have a stageId
      query = query.is("sub_stage_id", null);
    }
    if (orderId) {
      query = query.eq("items.order_id", orderId);
    }

    query = query.order("created_at", { ascending: false });

    const { data: allocations, error: dbError } = await query;

    if (dbError) {
      console.error("Database error fetching items for export:", dbError);
      throw dbError;
    }

    // --- Process Data using the same logic as useItemsInStage ---
    const processedData =
      allocations
        ?.map((alloc) => {
          const typedAlloc = alloc as unknown as ItemAllocation;
          const itemDetails =
            Array.isArray(typedAlloc.items) && typedAlloc.items.length > 0
              ? typedAlloc.items[0]
              : !Array.isArray(typedAlloc.items)
                ? typedAlloc.items
                : null;

          if (!itemDetails) {
            console.warn(
              "Skipping allocation due to missing item details:",
              typedAlloc
            );
            return null;
          }

          const movementEntries = itemDetails.item_movement_history || [];

          const currentStageMovement = movementEntries
            .filter(
              (h: HistoryMovementEntry) =>
                h.to_stage_id === typedAlloc.stage_id &&
                h.to_sub_stage_id === typedAlloc.sub_stage_id
            )
            .sort(
              (a: HistoryMovementEntry, b: HistoryMovementEntry) =>
                new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()
            );

          const latestEntryForCurrentStage = currentStageMovement[0] ?? null;
          const enteredAt = latestEntryForCurrentStage?.moved_at ?? null;

          // Apply date range filters if specified
          if (startDate && enteredAt) {
            if (new Date(enteredAt) < new Date(startDate)) {
              return null; // Filter out items that entered before start date
            }
          }
          if (endDate && enteredAt) {
            if (new Date(enteredAt) > new Date(endDate)) {
              return null; // Filter out items that entered after end date
            }
          }

          return {
            item_id: itemDetails.id,
            sku: itemDetails.sku,
            order_id: itemDetails.order_id,
            order_number: itemDetails.orders?.order_number ?? null,
            quantity: typedAlloc.quantity,
            current_stage_entered_at: enteredAt,
            instance_details: itemDetails.instance_details,
            stage_id: typedAlloc.stage_id,
            sub_stage_id: typedAlloc.sub_stage_id,
          };
        })
        .filter(Boolean) || [];

    const formattedData = processedData as PdfItemData[];

    // --- Generate PDF with Modern Styling ---
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));

    // Create a promise that resolves when the PDF is finished
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });
    });

    // Define modern color palette
    const colors = {
      primary: "#1e40af", // Blue-700
      secondary: "#64748b", // Slate-500
      accent: "#0ea5e9", // Sky-500
      success: "#059669", // Emerald-600
      danger: "#dc2626", // Red-600
      warning: "#d97706", // Amber-600
      light: "#f8fafc", // Slate-50
      border: "#e2e8f0", // Slate-200
      text: "#0f172a", // Slate-900
      textMuted: "#64748b", // Slate-500
    };

    // Header with Trakure branding
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(24)
      .text("TRAKURE", 50, 50, { align: "left" })
      .fontSize(10)
      .fillColor(colors.textMuted)
      .text("Export Workflows, Perfected", 50, 80)
      .text("www.trakure.com", 50, 95);

    // Add a modern header line
    doc
      .moveTo(50, 120)
      .lineTo(545, 120)
      .strokeColor(colors.accent)
      .lineWidth(3)
      .stroke();

    // Report title
    doc
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Items Export Report", 50, 140)
      .moveDown(0.3);

    // Organization and generation info
    doc
      .fontSize(11)
      .fillColor(colors.textMuted)
      .text(`Organization: ${orgData.name}`, 50, 170)
      .text(
        `Generated on ${format(new Date(), "EEEE, MMMM do, yyyy 'at' h:mm a")}`,
        50,
        185
      )
      .text(`Generated by ${profile.full_name}`, 50, 200);

    let currentY = 230;

    // Export criteria section
    doc
      .rect(50, currentY, 495, 100)
      .fillColor(colors.light)
      .fill()
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Export Criteria", 65, currentY + 15);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(colors.text)
      .text(`Total Items: ${formattedData.length}`, 65, currentY + 35);

    let criteriaY = currentY + 35;
    if (stageId) {
      const stageName = stageNameMap.get(stageId) || "Unknown Stage";
      doc.text(`Stage: ${stageName}`, 300, criteriaY);
      criteriaY += 15;
    }

    if (subStageId) {
      const subStageName =
        subStageNameMap.get(subStageId) || "Unknown Sub-Stage";
      doc.text(`Sub-Stage: ${subStageName}`, 300, criteriaY);
      criteriaY += 15;
    }

    if (startDate || endDate) {
      const dateRangeText = `Date Range: ${startDate ? format(new Date(startDate), "PP") : "Start"} - ${endDate ? format(new Date(endDate), "PP") : "End"}`;
      doc.text(dateRangeText, 65, currentY + 50);
    }

    if (orderId) {
      doc.text(`Order ID Filter: ${orderId}`, 65, currentY + 65);
    }

    currentY += 120;

    // Items Section
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Items List", 50, currentY);

    // Add decorative line under section title
    doc
      .moveTo(50, currentY + 20)
      .lineTo(150, currentY + 20)
      .strokeColor(colors.accent)
      .lineWidth(2)
      .stroke();

    currentY += 35;

    if (formattedData.length === 0) {
      doc
        .rect(50, currentY, 495, 40)
        .fillColor("#f1f5f9") // Slate-100
        .fill()
        .strokeColor(colors.border)
        .lineWidth(1)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(colors.textMuted)
        .text(
          "No items found matching the specified criteria.",
          65,
          currentY + 15
        );

      currentY += 60;
    } else {
      // Modern table with improved styling
      formattedData.forEach((item, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const bgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc"; // Alternating row colors

        // Item container
        doc
          .rect(50, currentY, 495, 80)
          .fillColor(bgColor)
          .fill()
          .strokeColor(colors.border)
          .lineWidth(1)
          .stroke();

        // Item number badge
        doc
          .fillColor(colors.primary)
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(`#${index + 1}`, 65, currentY + 15);

        // SKU
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(colors.text)
          .text(`SKU: ${item.sku || "N/A"}`, 100, currentY + 15);

        // Order number
        if (item.order_number) {
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(colors.textMuted)
            .text(`Order: ${item.order_number}`, 350, currentY + 15);
        }

        // Quantity
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(colors.text)
          .text(`Qty: ${item.quantity}`, 450, currentY + 15);

        // Current stage and sub-stage
        const stageName = stageNameMap.get(item.stage_id) || "Unknown Stage";
        const locationText = item.sub_stage_id
          ? `${stageName} > ${subStageNameMap.get(item.sub_stage_id) || "Unknown Sub-Stage"}`
          : stageName;

        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(colors.text)
          .text(`Location: ${locationText}`, 65, currentY + 35);

        // Entered at timestamp
        if (item.current_stage_entered_at) {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(colors.textMuted)
            .text(
              `Entered: ${format(new Date(item.current_stage_entered_at), "MMM d, yyyy 'at' h:mm a")}`,
              65,
              currentY + 50
            );
        }

        // Instance details (if any)
        if (
          item.instance_details &&
          Object.keys(item.instance_details).length > 0
        ) {
          const detailsText = Object.entries(item.instance_details)
            .slice(0, 3) // Limit to first 3 details to avoid overflow
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");

          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(colors.textMuted)
            .text(`Details: ${detailsText}`, 65, currentY + 65, { width: 400 });
        }

        currentY += 95;
      });
    }

    // Modern footer
    currentY += 20;

    // Check if we have enough space for footer (need at least 80 points)
    if (currentY > 720) {
      doc.addPage();
      currentY = 50;
    }

    doc
      .moveTo(50, currentY)
      .lineTo(545, currentY)
      .strokeColor(colors.accent)
      .lineWidth(3)
      .stroke();

    currentY += 15;

    // Footer content with Trakure branding
    doc
      .fillColor(colors.textMuted)
      .font("Helvetica")
      .fontSize(9)
      .text("Generated by Trakure - Export Workflows, Perfected", 50, currentY)
      .text("www.trakure.com", 50, currentY + 12);

    // Statistics on the right
    doc.text(`Total Items Exported: ${formattedData.length}`, 350, currentY, {
      align: "right",
    });

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    const pdfBuffer = await pdfPromise;

    const filename = `items_export_report_${format(new Date(), "HHmmss")}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF export:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to generate PDF export", details: message },
      { status: 500 }
    );
  }
}
