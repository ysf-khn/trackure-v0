import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Schema for the request body when associating an image
const createImageAssociationSchema = z.object({
  storagePath: z.string().min(1, "Storage path is required"),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  contentType: z.string().optional(),
  remarkId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : null)), // Convert string to number for BIGINT
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // const cookieStore = cookies(); // Removed unused variable
  const { itemId } = await params;

  if (!itemId || !z.string().uuid().safeParse(itemId).success) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }
  const supabase = await createClient();

  // 1. Authentication & Authorization - Fetch user and profile
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error [Item Image POST]:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role") // Fetch role too for potential RBAC
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      `Profile Error [Item Image POST] for user ${user.id}:`,
      profileError?.message ?? "Profile or organization_id not found."
    );
    return NextResponse.json(
      {
        error:
          profileError?.message ||
          "Unauthorized: User profile or organization mapping not found.",
      },
      { status: 401 } // Treat missing profile/org as auth issue
    );
  }
  const organizationId = profile.organization_id;
  // const userRole = profile.role; // Commented out as RBAC check is not active

  // Optional: Add RBAC check if only specific roles can upload/associate
  // Example: Check if userRole is 'Owner' or 'Worker'
  // if (userRole !== 'Owner' && userRole !== 'Worker') {
  //   return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
  // }

  // 2. Input Validation
  let requestData;
  try {
    const body = await request.json();
    requestData = createImageAssociationSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod Validation Error [Item Image POST]:", error.errors);
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Invalid Request Body [Item Image POST]:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Check if Item exists and belongs to the user's organization
  const { data: itemData, error: itemError } = await supabase
    .from("items")
    .select("id")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (itemError) {
    console.error("Error fetching item:", itemError);
    return NextResponse.json(
      { error: "Database error checking item" },
      { status: 500 }
    );
  }
  if (!itemData) {
    return NextResponse.json(
      { error: "Item not found or access denied" },
      { status: 404 }
    );
  }

  // 4. Insert Image Metadata into `item_images` table

  const { error: insertError, data: insertedImage } = await supabase
    .from("item_images")
    .insert({
      item_id: itemId,
      organization_id: organizationId, // Store org ID for RLS
      storage_path: requestData.storagePath,
      file_name: requestData.fileName,
      file_size_bytes: requestData.fileSizeBytes,
      content_type: requestData.contentType,
      uploaded_by: user.id,
      remark_id: requestData.remarkId, // Now properly converted to number or null
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting image metadata:", insertError);
    // TODO: Consider deleting the uploaded file from storage if DB insert fails
    return NextResponse.json(
      { error: "Failed to save image association" },
      { status: 500 }
    );
  }

  // 5. Clear Response
  return NextResponse.json(insertedImage, { status: 201 });
}

// Optional: GET handler to list images for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // const cookieStore = cookies(); // Removed unused variable
  const supabase = await createClient();
  const { itemId } = await params;

  if (!itemId || !z.string().uuid().safeParse(itemId).success) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  // Authentication & Authorization (also implicitly handled by RLS)
  // Fetch user and profile directly
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error [Item Image GET]:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Although RLS handles org isolation, fetching profile confirms user setup
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id") // Only need org_id existence check here
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error(
      `Profile Error [Item Image GET] for user ${user.id}:`,
      profileError?.message ?? "Profile or organization_id not found."
    );
    // RLS would likely prevent data fetch anyway, but good to check
    return NextResponse.json(
      {
        error:
          profileError?.message ||
          "Unauthorized: User profile or organization mapping not found.",
      },
      { status: 401 }
    );
  }
  // const organizationId = profile.organization_id; // We don't explicitly need the ID here due to RLS

  // Fetch images associated with the item (RLS ensures org isolation)
  const { data: images, error } = await supabase
    .from("item_images")
    .select(
      "id, storage_path, file_name, uploaded_at, uploaded_by, remark_id, content_type"
    ) // Select needed fields
    .eq("item_id", itemId)
    .order("uploaded_at", { ascending: false }); // Order by newest first

  if (error) {
    console.error("Error fetching item images:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }

  return NextResponse.json(images ?? [], { status: 200 });
}
