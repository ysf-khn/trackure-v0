import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteFromS3, generatePresignedDownloadUrl, getS3PublicUrl } from "@/lib/aws/s3-client";

// Schema for creating a receipt association
const createReceiptSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
  s3Url: z.union([z.string().url(), z.literal(""), z.undefined()]).optional(),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  contentType: z.string().optional(),
});

// GET - Fetch receipts for a payment with signed URLs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;

  if (!paymentId || !z.string().uuid().safeParse(paymentId).success) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  const supabase = await createClient();

  // Authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch receipts with organization validation
    const { data: receipts, error } = await supabase
      .from("vendor_payment_receipts")
      .select(`
        id,
        payment_id,
        s3_key,
        file_name,
        file_size_bytes,
        content_type,
        uploaded_by,
        uploaded_at,
        payment:vendor_payments(
          id,
          vendor_id,
          organization_id
        )
      `)
      .eq("payment_id", paymentId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching payment receipts:", error);
      return NextResponse.json(
        { error: "Failed to fetch payment receipts" },
        { status: 500 }
      );
    }

    // Generate signed URLs for each receipt
    const receiptsWithSignedUrls = await Promise.all(
      receipts.map(async (receipt) => {
        try {
          const signedUrl = await generatePresignedDownloadUrl(receipt.s3_key, 3600); // 1 hour expiry
          return {
            ...receipt,
            signedUrl,
            publicUrl: getS3PublicUrl(receipt.s3_key), // Fallback if bucket becomes public
          };
        } catch (urlError) {
          console.error(`Error generating signed URL for receipt ${receipt.id}:`, urlError);
          return {
            ...receipt,
            signedUrl: null,
            publicUrl: getS3PublicUrl(receipt.s3_key),
          };
        }
      })
    );

    return NextResponse.json({ receipts: receiptsWithSignedUrls });
  } catch (error) {
    console.error("Payment receipts GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Associate an uploaded receipt with a payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;

  if (!paymentId || !z.string().uuid().safeParse(paymentId).success) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  const supabase = await createClient();

  // Authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 403 }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const validationResult = createReceiptSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const receiptData = validationResult.data;

  try {
    // Verify the payment exists and belongs to user's organization
    const { data: payment, error: paymentError } = await supabase
      .from("vendor_payments")
      .select("organization_id, vendor_id")
      .eq("id", paymentId)
      .single();

    if (paymentError || payment?.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "Payment not found or access denied" },
        { status: 404 }
      );
    }

    // Generate S3 URL if not provided
    const s3Url = receiptData.s3Url || getS3PublicUrl(receiptData.s3Key);

    // Create receipt record
    const { data: newReceipt, error: insertError } = await supabase
      .from("vendor_payment_receipts")
      .insert({
        payment_id: paymentId,
        organization_id: profile.organization_id,
        s3_key: receiptData.s3Key,
        s3_url: s3Url,
        file_name: receiptData.fileName,
        file_size_bytes: receiptData.fileSizeBytes,
        content_type: receiptData.contentType,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating payment receipt:", insertError);
      
      // Try to clean up S3 file if database insert failed
      try {
        await deleteFromS3(receiptData.s3Key);
      } catch (s3Error) {
        console.error("Error cleaning up S3 file after failed insert:", s3Error);
      }

      return NextResponse.json(
        {
          error: "Failed to create payment receipt",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    // Generate signed URL for the response
    const signedUrl = await generatePresignedDownloadUrl(receiptData.s3Key, 3600);

    return NextResponse.json({
      receipt: {
        ...newReceipt,
        signedUrl,
        publicUrl: s3Url,
      },
    });
  } catch (error) {
    console.error("Payment receipt POST error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a receipt
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get("receiptId");

  if (!paymentId || !z.string().uuid().safeParse(paymentId).success) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  if (!receiptId || !z.string().uuid().safeParse(receiptId).success) {
    return NextResponse.json({ error: "Invalid receipt ID" }, { status: 400 });
  }

  const supabase = await createClient();

  // Authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get receipt with payment info for validation
    const { data: receipt, error: fetchError } = await supabase
      .from("vendor_payment_receipts")
      .select(`
        id,
        s3_key,
        uploaded_by,
        payment:vendor_payments(organization_id)
      `)
      .eq("id", receiptId)
      .eq("payment_id", paymentId)
      .single();

    if (fetchError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Check authorization (only uploader can delete)
    if (receipt.uploaded_by !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete receipts you uploaded" },
        { status: 403 }
      );
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("vendor_payment_receipts")
      .delete()
      .eq("id", receiptId);

    if (deleteError) {
      console.error("Error deleting payment receipt:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete payment receipt" },
        { status: 500 }
      );
    }

    // Delete from S3
    try {
      await deleteFromS3(receipt.s3_key);
    } catch (s3Error) {
      console.error("Error deleting receipt from S3:", s3Error);
      // Don't fail the request if S3 delete fails - database record is already gone
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payment receipt DELETE error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}