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
          };
        })
        .filter(Boolean) || [];

    const formattedData = processedData as PdfItemData[];

    // --- Generate PDF ---
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    // PDF Header
    doc.fontSize(20).text("Items Export Report", { align: "center" });
    doc.moveDown();

    // Export details
    doc.fontSize(12);
    doc.text(`Export Date: ${format(new Date(), "PPP")}`, { align: "left" });
    doc.text(`Total Items: ${formattedData.length}`, { align: "left" });

    if (stageId) {
      doc.text(`Stage ID: ${stageId}`, { align: "left" });
    }

    if (subStageId) {
      doc.text(`Sub-Stage ID: ${subStageId}`, { align: "left" });
    }

    if (startDate || endDate) {
      const dateRangeText = `Date Range: ${startDate ? format(new Date(startDate), "PP") : "Start"} - ${endDate ? format(new Date(endDate), "PP") : "End"}`;
      doc.text(dateRangeText, { align: "left" });
    }

    doc.moveDown(2);

    if (formattedData.length === 0) {
      doc
        .fontSize(14)
        .text("No items found matching the criteria.", { align: "center" });
    } else {
      // Table headers
      const tableTop = doc.y;
      const itemHeight = 20;
      let currentY = tableTop;

      // Define column positions and widths
      const columns = [
        { header: "SKU", x: 50, width: 80 },
        { header: "Order #", x: 130, width: 80 },
        { header: "Quantity", x: 210, width: 60 },
        { header: "Entered At", x: 270, width: 100 },
      ];

      // Draw table headers
      doc.fontSize(10).fillColor("black");
      columns.forEach((col) => {
        doc.rect(col.x, currentY, col.width, itemHeight).stroke();
        doc.text(col.header, col.x + 5, currentY + 5, {
          width: col.width - 10,
          height: itemHeight - 10,
          align: "left",
        });
      });

      currentY += itemHeight;

      // Draw table rows
      formattedData.forEach((item, index) => {
        // Check if we need a new page
        if (currentY + itemHeight > doc.page.height - 50) {
          doc.addPage();
          currentY = 50;

          // Redraw headers on new page
          columns.forEach((col) => {
            doc.rect(col.x, currentY, col.width, itemHeight).stroke();
            doc.text(col.header, col.x + 5, currentY + 5, {
              width: col.width - 10,
              height: itemHeight - 10,
              align: "left",
            });
          });
          currentY += itemHeight;
        }

        // Alternate row colors
        if (index % 2 === 1) {
          doc
            .rect(50, currentY, 370, itemHeight)
            .fillAndStroke("#f8f9fa", "#000000");
        }

        // Draw row data
        const rowData = [
          item.sku || "-",
          item.order_number || "-",
          item.quantity.toString(),
          item.current_stage_entered_at
            ? format(new Date(item.current_stage_entered_at), "MM/dd/yy")
            : "-",
        ];

        columns.forEach((col, colIndex) => {
          doc.rect(col.x, currentY, col.width, itemHeight).stroke();
          doc
            .fillColor("black")
            .text(rowData[colIndex], col.x + 5, currentY + 5, {
              width: col.width - 10,
              height: itemHeight - 10,
              align: "left",
            });
        });

        currentY += itemHeight;
      });
    }

    // Finalize the PDF
    doc.end();

    // Wait for the PDF to be generated
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // --- Return Response ---
    const filename = `items_export_${format(new Date(), "yyyy-MM-dd")}.pdf`;

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
