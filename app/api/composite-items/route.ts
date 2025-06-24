import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import type {
  CreateCompositeItemRequest,
  CompositeItemsResponse,
  CompositeItemError,
  CompositeItemDefinitionWithComponents,
} from "@/types/composite-items";

// Validation schemas
const createCompositeItemSchema = z.object({
  composite_sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  components: z
    .array(
      z.object({
        component_sku: z.string().min(1, "Component SKU is required"),
        quantity_per_composite: z
          .number()
          .min(1, "Quantity must be at least 1"),
      })
    )
    .min(1, "At least one component is required"),
});

// GET /api/composite-items - List all composite items for organization
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const active_only = searchParams.get("active_only") === "true";
    const search = searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("composite_item_definitions_with_components")
      .select("*")
      .eq("organization_id", profile.organization_id);

    // Apply filters
    if (active_only) {
      query = query.eq("is_active", true);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,composite_sku.ilike.%${search}%`
      );
    }

    // Apply pagination and ordering
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: compositeItems, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching composite items:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch composite items" },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("composite_item_definitions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id);

    if (active_only) {
      countQuery = countQuery.eq("is_active", true);
    }

    if (search) {
      countQuery = countQuery.or(
        `name.ilike.%${search}%,composite_sku.ilike.%${search}%`
      );
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error("Error counting composite items:", countError);
      return NextResponse.json(
        { error: "Failed to count composite items" },
        { status: 500 }
      );
    }

    const response: CompositeItemsResponse = {
      composite_items: compositeItems || [],
      total_count: totalCount || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in GET /api/composite-items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/composite-items - Create a new composite item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createCompositeItemSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { composite_sku, name, description, components } = validation.data;

    // Check if composite SKU exists in item_master, create if it doesn't
    const { data: itemMaster, error: itemMasterError } = await supabase
      .from("item_master")
      .select("sku, is_composite")
      .eq("sku", composite_sku)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (itemMasterError) {
      console.error("Error checking item master:", itemMasterError);
      return NextResponse.json(
        { error: "Failed to validate composite SKU" },
        { status: 500 }
      );
    }

    // Check if SKU is already defined as composite
    const { data: existingComposite, error: existingError } = await supabase
      .from("composite_item_definitions")
      .select("id")
      .eq("composite_sku", composite_sku)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing composite:", existingError);
      return NextResponse.json(
        { error: "Failed to check existing composite" },
        { status: 500 }
      );
    }

    if (existingComposite) {
      return NextResponse.json(
        { error: "Composite item already exists for this SKU" },
        { status: 409 }
      );
    }

    // Validate all component SKUs exist
    const componentSkus = components.map((c) => c.component_sku);
    const { data: componentValidation, error: componentError } = await supabase
      .from("item_master")
      .select("sku")
      .eq("organization_id", profile.organization_id)
      .in("sku", componentSkus);

    if (componentError) {
      console.error("Error validating component SKUs:", componentError);
      return NextResponse.json(
        { error: "Failed to validate component SKUs" },
        { status: 500 }
      );
    }

    const validSkus = componentValidation?.map((item) => item.sku) || [];
    const invalidSkus = componentSkus.filter((sku) => !validSkus.includes(sku));

    if (invalidSkus.length > 0) {
      return NextResponse.json(
        { error: `Invalid component SKUs: ${invalidSkus.join(", ")}` },
        { status: 400 }
      );
    }

    // Create or update composite SKU in item_master
    if (!itemMaster) {
      // Create new item master record for composite SKU
      const { error: createMasterError } = await supabase
        .from("item_master")
        .insert({
          sku: composite_sku,
          organization_id: profile.organization_id,
          item_name: name, // Use the composite name as item name
          is_composite: true,
          master_details: {
            description: description || null,
            type: "composite",
          },
        });

      if (createMasterError) {
        console.error("Error creating item master:", createMasterError);
        return NextResponse.json(
          { error: "Failed to create composite SKU in item master" },
          { status: 500 }
        );
      }
    } else if (!itemMaster.is_composite) {
      // Update existing item master to mark as composite
      const { error: updateMasterError } = await supabase
        .from("item_master")
        .update({ is_composite: true })
        .eq("sku", composite_sku)
        .eq("organization_id", profile.organization_id);

      if (updateMasterError) {
        console.error("Error updating item master:", updateMasterError);
        return NextResponse.json(
          { error: "Failed to mark SKU as composite in item master" },
          { status: 500 }
        );
      }
    }

    // Create composite item definition
    const { data: newComposite, error: createError } = await supabase
      .from("composite_item_definitions")
      .insert({
        composite_sku,
        organization_id: profile.organization_id,
        name,
        description,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating composite item:", createError);
      return NextResponse.json(
        { error: "Failed to create composite item" },
        { status: 500 }
      );
    }

    // Create component records
    const componentRecords = components.map((component) => ({
      composite_definition_id: newComposite.id,
      component_sku: component.component_sku,
      organization_id: profile.organization_id,
      quantity_per_composite: component.quantity_per_composite,
    }));

    const { error: componentsError } = await supabase
      .from("composite_item_components")
      .insert(componentRecords);

    if (componentsError) {
      console.error("Error creating component records:", componentsError);
      // Try to clean up the composite definition
      await supabase
        .from("composite_item_definitions")
        .delete()
        .eq("id", newComposite.id);

      return NextResponse.json(
        { error: "Failed to create component records" },
        { status: 500 }
      );
    }

    // Fetch the complete composite item with components
    const { data: completeComposite, error: fetchError } = await supabase
      .from("composite_item_definitions_with_components")
      .select("*")
      .eq("id", newComposite.id)
      .single();

    if (fetchError) {
      console.error("Error fetching complete composite:", fetchError);
      return NextResponse.json(
        { error: "Composite created but failed to fetch details" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { composite_item: completeComposite },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/composite-items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
