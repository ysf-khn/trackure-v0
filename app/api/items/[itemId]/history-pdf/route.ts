import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import PDFDocument from "pdfkit";
import { fetchAllItemHistory } from "@/lib/item-history-utils";

// Define query schema for validation
const querySchema = z.object({
  dateFrom: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid dateFrom: ${val}`);
      }
      return date;
    }),
  dateTo: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid dateTo: ${val}`);
      }
      return date;
    }),
  maxRecords: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        throw new Error(`Invalid maxRecords: ${val}`);
      }
      return num;
    }),
  includeRemarks: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const { searchParams } = new URL(request.url);

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
    console.error("Error fetching profile:", profileError);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }

  const orgId = profile.organization_id;
  if (!orgId) {
    return NextResponse.json(
      { error: "User organization not found" },
      { status: 400 }
    );
  }

  // Validate query parameters
  const queryParams = {
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    maxRecords: searchParams.get("maxRecords") || undefined,
    includeRemarks: searchParams.get("includeRemarks") || undefined,
  };

  const parseResult = querySchema.safeParse(queryParams);

  if (!parseResult.success) {
    console.error("Query parameter validation failed:", parseResult.error);
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parseResult.error.flatten(),
        received: queryParams,
      },
      { status: 400 }
    );
  }

  const { dateFrom, dateTo, maxRecords, includeRemarks } = parseResult.data;

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

    // Fetch item data with order information
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select(
        `
        id, 
        sku, 
        order_id,
        orders!inner(
          id,
          order_number,
          customer_name
        )
      `
      )
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .single();

    if (itemError || !itemData) {
      throw new Error("Failed to fetch item data or item not found");
    }

    // Fetch history data using the existing function
    const historyData = await fetchAllItemHistory(
      itemId,
      dateFrom,
      dateTo,
      maxRecords
    );

    // Fetch remarks if requested
    let remarksData: any[] = [];
    if (includeRemarks) {
      let remarksQuery = supabase
        .from("remarks")
        .select(
          `
          id,
          text,
          timestamp,
          user_id
        `
        )
        .eq("item_id", itemId)
        .order("timestamp", { ascending: false });

      // Apply date filters to remarks if provided
      if (dateFrom) {
        remarksQuery = remarksQuery.gte("timestamp", dateFrom.toISOString());
      }
      if (dateTo) {
        remarksQuery = remarksQuery.lte("timestamp", dateTo.toISOString());
      }

      // Apply limit to remarks if provided
      if (maxRecords) {
        remarksQuery = remarksQuery.limit(maxRecords);
      }

      const { data: remarks, error: remarksError } = await remarksQuery;
      if (!remarksError && remarks) {
        // Get user profiles for the remarks
        const userIds = remarks.map((r) => r.user_id).filter(Boolean);
        let profilesMap: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);

          if (!profilesError && profiles) {
            profilesMap = Object.fromEntries(
              profiles.map((p) => [p.id, p.full_name])
            );
          }
        }

        // Combine remarks with profile data
        remarksData = remarks.map((remark) => ({
          ...remark,
          profiles: {
            full_name: profilesMap[remark.user_id] || "Unknown User",
          },
        }));
      }
    }

    // Create PDF document
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
      .text("Item History Report", 50, 140)
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

    // Modern card-style item information section
    const itemInfoY = 230;
    doc
      .rect(50, itemInfoY, 495, 80)
      .fillColor(colors.light)
      .fill()
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Item Information", 65, itemInfoY + 15);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(colors.text)
      .text(`Item SKU: ${itemData.sku || itemData.id}`, 65, itemInfoY + 35);

    if (itemData.orders && itemData.orders.length > 0) {
      doc.text(
        `Order Number: ${itemData.orders[0].order_number}`,
        300,
        itemInfoY + 35
      );
    }
    if (
      itemData.orders &&
      itemData.orders.length > 0 &&
      itemData.orders[0].customer_name
    ) {
      doc.text(
        `Customer: ${itemData.orders[0].customer_name}`,
        300,
        itemInfoY + 50
      );
    }

    let currentY = itemInfoY + 100;

    // Filter Information (if any filters applied)
    if (dateFrom || dateTo || maxRecords) {
      doc
        .rect(50, currentY, 495, 60)
        .fillColor("#fef3c7") // Amber-100
        .fill()
        .strokeColor("#f59e0b") // Amber-500
        .lineWidth(1)
        .stroke();

      doc
        .fillColor(colors.warning)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Applied Filters", 65, currentY + 15);

      doc.font("Helvetica").fontSize(10).fillColor(colors.text);

      let filterY = currentY + 35;
      if (dateFrom) {
        doc.text(`From Date: ${format(dateFrom, "PPP")}`, 65, filterY);
        filterY += 15;
      }
      if (dateTo) {
        doc.text(`To Date: ${format(dateTo, "PPP")}`, 65, filterY);
        filterY += 15;
      }
      if (maxRecords) {
        doc.text(`Max Records: ${maxRecords}`, 300, currentY + 35);
      }

      currentY += 80;
    }

    currentY += 20;

    // Movement History Section
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Movement History", 50, currentY);

    // Add decorative line under section title
    doc
      .moveTo(50, currentY + 20)
      .lineTo(200, currentY + 20)
      .strokeColor(colors.accent)
      .lineWidth(2)
      .stroke();

    currentY += 35;

    if (historyData.length === 0) {
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
          "No movement history found for the specified criteria.",
          65,
          currentY + 15
        );

      currentY += 60;
    } else {
      historyData.forEach((entry, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const isRework = !!entry.rework_reason;
        const entryColor = isRework ? colors.danger : colors.success;
        const bgColor = isRework ? "#fef2f2" : "#f0fdf4"; // Red-50 or Green-50

        // Entry container
        doc
          .rect(50, currentY, 495, 70)
          .fillColor(bgColor)
          .fill()
          .strokeColor(entryColor)
          .lineWidth(1)
          .stroke();

        // Entry number and type badge
        doc
          .fillColor(entryColor)
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(`#${index + 1}`, 65, currentY + 15)
          .text(isRework ? "REWORK" : "MOVE FORWARD", 100, currentY + 15);

        // Timestamp
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(colors.textMuted)
          .text(
            format(new Date(entry.moved_at), "MMM d, yyyy 'at' h:mm a"),
            350,
            currentY + 15
          );

        // Movement details
        doc.font("Helvetica").fontSize(10).fillColor(colors.text);

        let detailY = currentY + 35;
        if (entry.from_stage_name) {
          doc.text(
            `From: ${entry.from_stage_name}${entry.from_sub_stage_name ? ` > ${entry.from_sub_stage_name}` : ""}`,
            65,
            detailY
          );
          detailY += 12;
        }
        doc.text(
          `To: ${entry.to_stage_name}${entry.to_sub_stage_name ? ` > ${entry.to_sub_stage_name}` : ""}`,
          65,
          detailY
        );

        doc.text(`Qty: ${entry.quantity}`, 350, currentY + 35);
        doc.text(`By: ${entry.user_full_name || "System"}`, 350, currentY + 47);

        if (entry.rework_reason) {
          doc
            .fillColor(colors.danger)
            .fontSize(9)
            .text(`Reason: ${entry.rework_reason}`, 65, currentY + 60, {
              width: 400,
            });
        }

        currentY += 85;
      });
    }

    // Remarks Section (if included)
    if (includeRemarks) {
      currentY += 20;

      doc
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .fontSize(16)
        .text("Remarks & Comments", 50, currentY);

      // Add decorative line under section title
      doc
        .moveTo(50, currentY + 20)
        .lineTo(220, currentY + 20)
        .strokeColor(colors.accent)
        .lineWidth(2)
        .stroke();

      currentY += 35;

      if (remarksData.length === 0) {
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
            "No remarks found for the specified criteria.",
            65,
            currentY + 15
          );

        currentY += 60;
      } else {
        remarksData.forEach((remark, index) => {
          // Check if we need a new page
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
          }

          // Remark container
          doc
            .rect(50, currentY, 495, 60)
            .fillColor("#fefbf3") // Amber-50
            .fill()
            .strokeColor("#f59e0b") // Amber-500
            .lineWidth(1)
            .stroke();

          // Remark number and badge
          doc
            .fillColor(colors.warning)
            .font("Helvetica-Bold")
            .fontSize(11)
            .text(`#${index + 1}`, 65, currentY + 15)
            .text("REMARK", 100, currentY + 15);

          // Timestamp
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(colors.textMuted)
            .text(
              format(new Date(remark.timestamp), "MMM d, yyyy 'at' h:mm a"),
              350,
              currentY + 15
            );

          // Author
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(colors.text)
            .text(
              `By: ${remark.profiles?.full_name || "Unknown User"}`,
              350,
              currentY + 30
            );

          // Remark text
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(colors.text)
            .text(remark.text, 65, currentY + 35, { width: 270, height: 20 });

          currentY += 75;
        });
      }
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
    doc.text(`Total Movement Records: ${historyData.length}`, 350, currentY, {
      align: "right",
    });
    if (includeRemarks) {
      doc.text(`Total Remarks: ${remarksData.length}`, 350, currentY + 12, {
        align: "right",
      });
    }

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    const pdfBuffer = await pdfPromise;

    const filename = `item_history_report_${format(new Date(), "HHmmss")}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating history PDF:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred.";
    return NextResponse.json(
      { error: "Failed to generate PDF", details: errorMessage },
      { status: 500 }
    );
  }
}
