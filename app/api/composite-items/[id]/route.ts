import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import type {
  UpdateCompositeItemRequest,
  CompositeItemResponse,
} from "@/types/composite-items";

// Validation schema for updates
const updateCompositeItemSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  components: z
    .array(
      z.object({
        component_sku: z.string().min(1, "Component SKU is required"),
        quantity_per_composite: z
          .number()
          .min(1, "Quantity must be at least 1"),
      })
    )
    .optional(),
});

// GET /api/composite-items/[id] - Get a specific composite item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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

    // Fetch the composite item with components
    const { data: compositeItem, error: fetchError } = await supabase
      .from("composite_item_definitions_with_components")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Composite item not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching composite item:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch composite item" },
        { status: 500 }
      );
    }

    const response: CompositeItemResponse = {
      composite_item: compositeItem,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in GET /api/composite-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/composite-items/[id] - Update a composite item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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
    const validation = updateCompositeItemSchema.safeParse(body);

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

    const { name, description, is_active, components } = validation.data;

    // Check if composite item exists
    const { data: existingComposite, error: existingError } = await supabase
      .from("composite_item_definitions")
      .select("id, composite_sku")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (existingError) {
      if (existingError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Composite item not found" },
          { status: 404 }
        );
      }
      console.error("Error checking existing composite:", existingError);
      return NextResponse.json(
        { error: "Failed to check composite item" },
        { status: 500 }
      );
    }

    // Update composite item definition (basic fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("composite_item_definitions")
        .update(updateData)
        .eq("id", id)
        .eq("organization_id", profile.organization_id);

      if (updateError) {
        console.error("Error updating composite item:", updateError);
        return NextResponse.json(
          { error: "Failed to update composite item" },
          { status: 500 }
        );
      }
    }

    // Update components if provided
    if (components !== undefined) {
      // Validate all component SKUs exist
      const componentSkus = components.map((c) => c.component_sku);
      const { data: componentValidation, error: componentError } =
        await supabase
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
      const invalidSkus = componentSkus.filter(
        (sku) => !validSkus.includes(sku)
      );

      if (invalidSkus.length > 0) {
        return NextResponse.json(
          { error: `Invalid component SKUs: ${invalidSkus.join(", ")}` },
          { status: 400 }
        );
      }

      // Delete existing components
      const { error: deleteError } = await supabase
        .from("composite_item_components")
        .delete()
        .eq("composite_definition_id", id);

      if (deleteError) {
        console.error("Error deleting existing components:", deleteError);
        return NextResponse.json(
          { error: "Failed to update components" },
          { status: 500 }
        );
      }

      // Insert new components
      if (components.length > 0) {
        const componentRecords = components.map((component) => ({
          composite_definition_id: id,
          component_sku: component.component_sku,
          organization_id: profile.organization_id,
          quantity_per_composite: component.quantity_per_composite,
        }));

        const { error: insertError } = await supabase
          .from("composite_item_components")
          .insert(componentRecords);

        if (insertError) {
          console.error("Error inserting new components:", insertError);
          return NextResponse.json(
            { error: "Failed to update components" },
            { status: 500 }
          );
        }
      }
    }

    // Fetch the updated composite item with components
    const { data: updatedComposite, error: fetchError } = await supabase
      .from("composite_item_definitions_with_components")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching updated composite:", fetchError);
      return NextResponse.json(
        { error: "Update completed but failed to fetch details" },
        { status: 500 }
      );
    }

    const response: CompositeItemResponse = {
      composite_item: updatedComposite,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in PUT /api/composite-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/composite-items/[id] - Delete a composite item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to delete (only owners can delete)
    if (profile.role !== "Owner") {
      return NextResponse.json(
        {
          error:
            "Insufficient permissions. Only owners can delete composite items.",
        },
        { status: 403 }
      );
    }

    // Check if composite item exists and get its SKU
    const { data: existingComposite, error: existingError } = await supabase
      .from("composite_item_definitions")
      .select("id, composite_sku")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (existingError) {
      if (existingError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Composite item not found" },
          { status: 404 }
        );
      }
      console.error("Error checking existing composite:", existingError);
      return NextResponse.json(
        { error: "Failed to check composite item" },
        { status: 500 }
      );
    }

    // Check if there are any active composite items in orders
    const { data: activeInstances, error: instancesError } = await supabase
      .from("items")
      .select("id")
      .eq("parent_composite_sku", existingComposite.composite_sku)
      .eq("organization_id", profile.organization_id)
      .limit(1);

    if (instancesError) {
      console.error("Error checking active instances:", instancesError);
      return NextResponse.json(
        { error: "Failed to check for active instances" },
        { status: 500 }
      );
    }

    if (activeInstances && activeInstances.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete composite item with active instances in orders. Consider deactivating instead.",
        },
        { status: 409 }
      );
    }

    // Delete the composite item (components will be cascade deleted)
    const { error: deleteError } = await supabase
      .from("composite_item_definitions")
      .delete()
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (deleteError) {
      console.error("Error deleting composite item:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete composite item" },
        { status: 500 }
      );
    }

    // Update item_master to remove composite flag
    const { error: updateMasterError } = await supabase
      .from("item_master")
      .update({ is_composite: false })
      .eq("sku", existingComposite.composite_sku)
      .eq("organization_id", profile.organization_id);

    if (updateMasterError) {
      console.error("Error updating item master:", updateMasterError);
      // Continue anyway - this is not critical
    }

    return NextResponse.json(
      { message: "Composite item deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/composite-items/[id]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
