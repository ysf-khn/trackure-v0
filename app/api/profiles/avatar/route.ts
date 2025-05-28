import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error [Avatar Upload]:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("avatar") as File;
    const userId = formData.get("userId") as string;

    if (!file) {
      console.error("No file provided in form data");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (userId !== user.id) {
      console.error("User ID mismatch:", { provided: userId, actual: user.id });
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 3. Validate file type and size
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // 4. Upload to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`; // Simplified path for profile images

    // Convert File to ArrayBuffer for Supabase upload
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(filePath, fileBuffer, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Storage upload error: ", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 5. Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-images").getPublicUrl(filePath);

    // 6. Update user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        avatar_url: publicUrl,
      },
    });

    if (updateError) {
      console.error("User metadata update error:", updateError);
      // Try to clean up uploaded file
      await supabase.storage.from("profile-images").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to update profile: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 7. Return response with CORS headers
    const response = NextResponse.json({
      avatarUrl: publicUrl,
      message: "Avatar updated successfully",
    });

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    return response;
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Add OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
