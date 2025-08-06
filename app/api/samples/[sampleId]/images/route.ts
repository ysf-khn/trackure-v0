import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteFromS3, getS3PublicUrl, generatePresignedDownloadUrl } from "@/lib/aws/s3-client";

// Schema for the request body when associating a sample image
const createSampleImageSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
  s3Url: z.string().url("Invalid S3 URL").optional(), // Made optional - will be generated server-side
  fileName: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  contentType: z.string().optional(),
  imageType: z.enum(["general", "front", "back", "side", "top", "bottom", "detail", "packaging"]).default("general"),
  caption: z.string().optional(),
  displayOrder: z.number().int().default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> }
) {
  const { sampleId } = await params;

  if (!sampleId || !z.string().uuid().safeParse(sampleId).success) {
    return NextResponse.json({ error: "Invalid sample ID" }, { status: 400 });
  }
  
  const supabase = await createClient();

  // 1. Authentication & Authorization - Fetch user and profile
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error [Sample Image POST]:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      `Profile Error [Sample Image POST] for user ${user.id}:`,
      profileError?.message ?? "Profile or organization_id not found."
    );
    return NextResponse.json(
      {
        error:
          profileError?.message ||
          "Unauthorized: User profile or organization mapping not found.",
      },
      { status: 401 }
    );
  }
  
  const organizationId = profile.organization_id;
  const userRole = profile.role;

  // RBAC Check: Check permission for workers
  if (userRole === "Worker") {
    const { data: hasPermission, error: permissionError } = await supabase.rpc(
      "worker_has_permission",
      {
        permission_key: "samples.images",
      }
    );

    if (permissionError) {
      console.error("Error checking permissions:", permissionError);
      return NextResponse.json(
        { error: "Failed to verify permissions" },
        { status: 500 }
      );
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to upload sample images" },
        { status: 403 }
      );
    }
  } else if (userRole !== "Owner") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  // 2. Input Validation
  let requestData;
  try {
    const body = await request.json();
    requestData = createSampleImageSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod Validation Error [Sample Image POST]:", error.errors);
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Invalid Request Body [Sample Image POST]:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Check if Sample exists and belongs to the user's organization
  const { data: sampleData, error: sampleError } = await supabase
    .from("samples")
    .select("id")
    .eq("id", sampleId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (sampleError) {
    console.error("Error fetching sample:", sampleError);
    return NextResponse.json(
      { error: "Database error checking sample" },
      { status: 500 }
    );
  }
  if (!sampleData) {
    return NextResponse.json(
      { error: "Sample not found or access denied" },
      { status: 404 }
    );
  }

  // 4. Insert Image Metadata into `sample_images` table
  // Generate the S3 URL server-side to ensure it has correct environment variables
  const s3Url = requestData.s3Url || getS3PublicUrl(requestData.s3Key);
  
  const { error: insertError, data: insertedImage } = await supabase
    .from("sample_images")
    .insert({
      sample_id: sampleId,
      organization_id: organizationId, // Add organization_id for RLS
      s3_key: requestData.s3Key,
      s3_url: s3Url,
      file_name: requestData.fileName,
      file_size_bytes: requestData.fileSizeBytes,
      content_type: requestData.contentType,
      image_type: requestData.imageType,
      caption: requestData.caption,
      display_order: requestData.displayOrder,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting sample image metadata:", insertError);
    console.error("Insert error details:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    // Try to delete the uploaded file from S3 if DB insert fails
    try {
      await deleteFromS3(requestData.s3Key);
    } catch (deleteError) {
      console.error("Failed to delete S3 file after DB error:", deleteError);
    }
    return NextResponse.json(
      { 
        error: "Failed to save image association",
        details: insertError.message,
        code: insertError.code 
      },
      { status: 500 }
    );
  }

  return NextResponse.json(insertedImage, { status: 201 });
}

// GET handler to list images for a sample
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> }
) {
  const supabase = await createClient();
  const { sampleId } = await params;

  if (!sampleId || !z.string().uuid().safeParse(sampleId).success) {
    return NextResponse.json({ error: "Invalid sample ID" }, { status: 400 });
  }

  // Authentication & Authorization
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error [Sample Image GET]:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      `Profile Error [Sample Image GET] for user ${user.id}:`,
      profileError?.message ?? "Profile or organization_id not found."
    );
    return NextResponse.json(
      {
        error:
          profileError?.message ||
          "Unauthorized: User profile or organization mapping not found.",
      },
      { status: 401 }
    );
  }

  // Check if the sample exists and belongs to organization
  const { data: sampleExists } = await supabase
    .from("samples")
    .select("id")
    .eq("id", sampleId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!sampleExists) {
    // Return empty array instead of 404 to avoid confusion
    // The sample might not exist, but that's not an error for fetching images
    return NextResponse.json([], { status: 200 });
  }

  // Fetch images associated with the sample (RLS ensures org isolation)
  const { data: images, error } = await supabase
    .from("sample_images")
    .select(
      "id, s3_key, s3_url, image_url, file_name, image_type, caption, display_order, uploaded_at, uploaded_by, content_type"
    )
    .eq("sample_id", sampleId)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching sample images:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }

  // Generate presigned URLs for private bucket access
  const imagesWithPresignedUrls = await Promise.all(
    (images ?? []).map(async (image) => {
      if (image.s3_key) {
        try {
          // Generate presigned URL valid for 1 hour
          const presignedUrl = await generatePresignedDownloadUrl(image.s3_key, 3600);
          return {
            ...image,
            s3_url: presignedUrl, // Replace the stored URL with presigned URL
          };
        } catch (error) {
          console.error(`Error generating presigned URL for image ${image.id}:`, error);
          // Return image with original URL if presigned generation fails
          return image;
        }
      }
      return image;
    })
  );

  return NextResponse.json(imagesWithPresignedUrls, { status: 200 });
}

// DELETE handler to remove a sample image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> }
) {
  const supabase = await createClient();
  const { sampleId } = await params;
  const url = new URL(request.url);
  const imageId = url.searchParams.get("imageId");

  if (!sampleId || !z.string().uuid().safeParse(sampleId).success) {
    return NextResponse.json({ error: "Invalid sample ID" }, { status: 400 });
  }

  if (!imageId || !z.string().uuid().safeParse(imageId).success) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  // Authentication & Authorization
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = profile.role;

  // Check permissions for workers
  if (userRole === "Worker") {
    const { data: hasPermission, error: permissionError } = await supabase.rpc(
      "worker_has_permission",
      { permission_key: "samples.images" }
    );

    if (permissionError || !hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to delete sample images" },
        { status: 403 }
      );
    }
  }

  // Get the image record to find the S3 key
  const { data: imageData, error: imageError } = await supabase
    .from("sample_images")
    .select("s3_key")
    .eq("id", imageId)
    .eq("sample_id", sampleId)
    .single();

  if (imageError || !imageData) {
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404 }
    );
  }

  // Delete from database first
  const { error: deleteError } = await supabase
    .from("sample_images")
    .delete()
    .eq("id", imageId)
    .eq("sample_id", sampleId);

  if (deleteError) {
    console.error("Error deleting sample image:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }

  // Delete from S3 if we have an S3 key
  if (imageData.s3_key) {
    try {
      await deleteFromS3(imageData.s3_key);
    } catch (s3Error) {
      console.error("Failed to delete from S3:", s3Error);
      // Don't fail the request if S3 deletion fails, as the DB record is already gone
    }
  }

  return NextResponse.json({ message: "Image deleted successfully" });
}