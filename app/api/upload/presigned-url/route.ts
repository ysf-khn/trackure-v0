import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePresignedUploadUrl, generateS3Key } from "@/lib/aws/s3-client";

// Schema for presigned URL request
const presignedUrlSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  contentType: z.string().min(1, "Content type is required"),
  type: z.enum(["item", "sample", "profile", "vendor-payment"]),
  entityId: z.string().uuid("Invalid entity ID"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: "Profile or organization not found" },
        { status: 401 }
      );
    }

    const organizationId = profile.organization_id;
    const userRole = profile.role;

    // Parse request body
    let requestData;
    try {
      const body = await request.json();
      requestData = presignedUrlSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate content type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ];

    if (!allowedTypes.includes(requestData.contentType)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Check permissions for workers
    if (userRole === "Worker") {
      let permissionKey: string;
      
      if (requestData.type === "vendor-payment") {
        permissionKey = "vendors.manage_payments";
      } else {
        permissionKey = `${requestData.type}s.images`;
      }
      
      const { data: hasPermission, error: permissionError } = await supabase.rpc(
        "worker_has_permission",
        { permission_key: permissionKey }
      );

      if (permissionError || !hasPermission) {
        return NextResponse.json(
          { error: "You don't have permission to upload files for this type" },
          { status: 403 }
        );
      }
    }

    // Additional validation based on type
    if (requestData.type === "item") {
      // Verify item exists and belongs to organization
      const { data: item, error: itemError } = await supabase
        .from("items")
        .select("id")
        .eq("id", requestData.entityId)
        .eq("organization_id", organizationId)
        .single();

      if (itemError || !item) {
        return NextResponse.json(
          { error: "Item not found or access denied" },
          { status: 404 }
        );
      }
    } else if (requestData.type === "sample") {
      // Allow temporary sample IDs for new sample creation
      if (requestData.entityId !== "temp-sample-id") {
        // Verify sample exists and belongs to organization
        const { data: sample, error: sampleError } = await supabase
          .from("samples")
          .select("id")
          .eq("id", requestData.entityId)
          .eq("organization_id", organizationId)
          .single();

        if (sampleError || !sample) {
          return NextResponse.json(
            { error: "Sample not found or access denied" },
            { status: 404 }
          );
        }
      }
    } else if (requestData.type === "profile") {
      // For profile images, entity ID should be the user ID
      if (requestData.entityId !== user.id && userRole !== "Owner") {
        return NextResponse.json(
          { error: "You can only upload your own profile image" },
          { status: 403 }
        );
      }
    } else if (requestData.type === "vendor-payment") {
      // Verify payment exists and belongs to organization
      const { data: payment, error: paymentError } = await supabase
        .from("vendor_payments")
        .select("id, organization_id")
        .eq("id", requestData.entityId)
        .eq("organization_id", organizationId)
        .single();

      if (paymentError || !payment) {
        return NextResponse.json(
          { error: "Payment not found or access denied" },
          { status: 404 }
        );
      }
    }

    // Generate S3 key
    const s3Key = generateS3Key(
      requestData.type,
      organizationId,
      requestData.entityId,
      requestData.fileName
    );

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await generatePresignedUploadUrl(
      s3Key,
      requestData.contentType,
      3600
    );

    // Return presigned URL and S3 key
    return NextResponse.json({
      uploadUrl: presignedUrl,
      s3Key,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}