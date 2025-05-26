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

  console.log("Received query parameters:", queryParams);

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

    // Fetch item data
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id, sku, order_id")
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
          profiles:user_id(full_name)
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
        remarksData = remarks;
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

    // Define colors
    const primaryColor = "#2c3e50";
    const secondaryColor = "#7f8c8d";
    const reworkColor = "#e74c3c";

    // Header
    doc
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(`${orgData.name} - Item History Report`, { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor(secondaryColor)
      .text(`Generated on ${format(new Date(), "PPpp")}`, {
        align: "center",
      })
      .text(`Generated by ${profile.full_name}`, {
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
      .moveDown(1);

    // Item Information
    doc.font("Helvetica-Bold").fontSize(14).fillColor(primaryColor);
    doc.text("Item Information", { underline: true }).moveDown(0.5);

    doc.font("Helvetica").fontSize(11).fillColor("black");
    doc.text(`Item SKU: ${itemData.sku || itemData.id}`);
    doc.text(`Item ID: ${itemData.id}`);
    if (itemData.order_id) {
      doc.text(`Order ID: ${itemData.order_id}`);
    }
    doc.moveDown();

    // Filter Information
    if (dateFrom || dateTo || maxRecords) {
      doc.font("Helvetica-Bold").fontSize(12).fillColor(primaryColor);
      doc.text("Applied Filters:", { underline: true }).moveDown(0.3);

      doc.font("Helvetica").fontSize(10).fillColor(secondaryColor);
      if (dateFrom) {
        doc.text(`From Date: ${format(dateFrom, "PPP")}`);
      }
      if (dateTo) {
        doc.text(`To Date: ${format(dateTo, "PPP")}`);
      }
      if (maxRecords) {
        doc.text(`Max Records: ${maxRecords}`);
      }
      doc.moveDown();
    }

    // Movement History Section
    doc.font("Helvetica-Bold").fontSize(14).fillColor(primaryColor);
    doc.text("Movement History", { underline: true }).moveDown(0.5);

    if (historyData.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor(secondaryColor);
      doc
        .text("No movement history found for the specified criteria.")
        .moveDown();
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("black");

      historyData.forEach((entry, index) => {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        const isRework = !!entry.rework_reason;

        // Entry header
        doc.font("Helvetica-Bold").fontSize(10);
        doc.fillColor(isRework ? reworkColor : primaryColor);
        doc.text(`${index + 1}. ${isRework ? "REWORK" : "MOVE FORWARD"}`, {
          continued: true,
        });

        doc.font("Helvetica").fontSize(9).fillColor(secondaryColor);
        doc.text(` - ${format(new Date(entry.moved_at), "PPp")}`);

        // Entry details
        doc.font("Helvetica").fontSize(9).fillColor("black");

        if (entry.from_stage_name) {
          doc.text(
            `   From: ${entry.from_stage_name}${entry.from_sub_stage_name ? ` > ${entry.from_sub_stage_name}` : ""}`
          );
        }
        doc.text(
          `   To: ${entry.to_stage_name}${entry.to_sub_stage_name ? ` > ${entry.to_sub_stage_name}` : ""}`
        );
        doc.text(`   Quantity: ${entry.quantity}`);
        doc.text(`   By: ${entry.user_full_name || "System"}`);

        if (entry.rework_reason) {
          doc.fillColor(reworkColor);
          doc.text(`   Rework Reason: ${entry.rework_reason}`);
          doc.fillColor("black");
        }

        doc.moveDown(0.3);
      });
    }

    // Remarks Section (if included)
    if (includeRemarks) {
      doc.moveDown();
      doc.font("Helvetica-Bold").fontSize(14).fillColor(primaryColor);
      doc.text("Remarks", { underline: true }).moveDown(0.5);

      if (remarksData.length === 0) {
        doc.font("Helvetica").fontSize(11).fillColor(secondaryColor);
        doc.text("No remarks found for the specified criteria.").moveDown();
      } else {
        remarksData.forEach((remark, index) => {
          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.font("Helvetica-Bold").fontSize(10).fillColor(primaryColor);
          doc.text(`${index + 1}. Remark`, { continued: true });

          doc.font("Helvetica").fontSize(9).fillColor(secondaryColor);
          doc.text(` - ${format(new Date(remark.timestamp), "PPp")}`);

          doc.font("Helvetica").fontSize(9).fillColor("black");
          doc.text(`   By: ${remark.profiles?.full_name || "Unknown User"}`);
          doc.text(`   Text: ${remark.text}`, { width: 495 });

          doc.moveDown(0.3);
        });
      }
    }

    // Footer
    doc.moveDown();
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#bdc3c7")
      .lineWidth(1)
      .stroke()
      .moveDown(0.5);

    doc.font("Helvetica").fontSize(8).fillColor(secondaryColor);
    doc.text(`Total Movement Records: ${historyData.length}`, {
      align: "center",
    });
    if (includeRemarks) {
      doc.text(`Total Remarks: ${remarksData.length}`, { align: "center" });
    }

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    const pdfBuffer = await pdfPromise;

    const filename = `item_history_${itemData.sku || itemData.id}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;

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
