import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const supabase = await createClient();
    const imagePath = (await params).path.join("/");

    // Get bucket from query parameter, default to profile-images for backward compatibility
    const url = new URL(request.url);
    const bucket = url.searchParams.get("bucket") || "profile-images";

    // Check if client has cached version using If-None-Match header
    const clientETag = request.headers.get("if-none-match");
    const imageETag = `"${imagePath}-${bucket}"`;

    // If client has the same ETag, return 304 Not Modified
    if (clientETag === imageETag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: imageETag,
        },
      });
    }

    // Download the image from Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(imagePath);

    if (error) {
      console.error("Error downloading image:", error);
      return new NextResponse("Image not found", { status: 404 });
    }

    // Convert blob to array buffer
    const arrayBuffer = await data.arrayBuffer();

    // Determine content type based on file extension
    const extension = imagePath.split(".").pop()?.toLowerCase();
    let contentType = "image/jpeg"; // default

    switch (extension) {
      case "png":
        contentType = "image/png";
        break;
      case "webp":
        contentType = "image/webp";
        break;
      case "gif":
        contentType = "image/gif";
        break;
      case "svg":
        contentType = "image/svg+xml";
        break;
    }

    // Return the image with proper caching headers
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: imageETag,
        "Access-Control-Allow-Origin": "*",
        Vary: "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
