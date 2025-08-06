import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generatePresignedDownloadUrl } from "@/lib/aws/s3-client";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get samples with their attributes and vendor details
    const { data: samples, error: samplesError } = await supabase
      .from("samples")
      .select(`
        *,
        attributes:sample_attributes(
          attribute_name,
          attribute_value,
          attribute_unit,
          vendor_id,
          display_order,
          vendor:vendors(
            id,
            name
          )
        ),
        images:sample_images(
          id,
          s3_key,
          s3_url,
          file_name,
          image_type,
          display_order
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (samplesError) {
      console.error("Error fetching samples:", samplesError);
      return NextResponse.json({ error: "Failed to fetch samples" }, { status: 500 });
    }

    // Generate presigned URLs for sample thumbnails
    const samplesWithThumbnails = await Promise.all(
      (samples || []).map(async (sample) => {
        let thumbnailUrl = null;
        
        // Get the first image as thumbnail
        if (sample.images && sample.images.length > 0) {
          const firstImage = sample.images.sort((a: any, b: any) => 
            (a.display_order || 0) - (b.display_order || 0)
          )[0];
          
          if (firstImage.s3_key) {
            try {
              thumbnailUrl = await generatePresignedDownloadUrl(firstImage.s3_key, 3600);
            } catch (error) {
              console.error(`Error generating presigned URL for sample ${sample.id}:`, error);
            }
          }
        }
        
        return {
          ...sample,
          thumbnailUrl,
          imageCount: sample.images?.length || 0
        };
      })
    );

    const meta = {
      total_count: samplesWithThumbnails?.length || 0,
    };

    return NextResponse.json({ samples: samplesWithThumbnails, meta });

  } catch (error) {
    console.error("Error in samples API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.sku || !body.name || !body.quantity || !body.size) {
      return NextResponse.json(
        { error: "SKU, name, quantity, and size are required" },
        { status: 400 }
      );
    }

    // Validate SKU exists in organization
    const { data: skuExists, error: skuError } = await supabase
      .from("item_master")
      .select("sku")
      .eq("sku", body.sku)
      .eq("organization_id", profile.organization_id)
      .single();

    if (skuError || !skuExists) {
      return NextResponse.json(
        { error: "Invalid SKU - SKU does not exist in your organization" },
        { status: 400 }
      );
    }

    // No location validation needed - using simple location field

    // Validate any vendor IDs in attributes
    if (body.attributes && Array.isArray(body.attributes)) {
      for (const attr of body.attributes) {
        if (attr.attribute_name && attr.attribute_name.toLowerCase().includes('vendor') && attr.attribute_value) {
          const { data: vendor } = await supabase
            .from("vendors")
            .select("id, name")
            .eq("id", attr.attribute_value)
            .eq("organization_id", profile.organization_id)
            .single();
          
          if (!vendor) {
            return NextResponse.json(
              { error: `Invalid vendor ID for ${attr.attribute_name}` },
              { status: 400 }
            );
          }
          // Replace vendor ID with vendor name for display
          attr.attribute_value = vendor.name;
        }
      }
    }

    // Insert the sample
    const { data: sample, error: sampleError } = await supabase
      .from("samples")
      .insert({
        organization_id: profile.organization_id,
        sku: body.sku,
        name: body.name,
        quantity: parseInt(body.quantity),
        size: body.size,
        location: body.location || null,
        created_by: user.id
      })
      .select()
      .single();

    if (sampleError) {
      console.error("Error creating sample:", sampleError);
      if (sampleError.code === '23505') {
        return NextResponse.json(
          { error: "A sample with this combination already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: sampleError.message || "Failed to create sample" },
        { status: 500 }
      );
    }

    // Insert attributes if any
    if (body.attributes && body.attributes.length > 0) {
      console.log('Attempting to save attributes:', body.attributes);
      
      const attributes = body.attributes.map((attr: any, index: number) => {
        const attributeData = {
          sample_id: sample.id,
          attribute_category: 'general',
          attribute_name: attr.attribute_name,
          attribute_value: attr.attribute_value,
          attribute_unit: null,
          vendor_id: attr.vendor_id && attr.vendor_id.trim() !== '' ? attr.vendor_id : null,
          display_order: index
        };
        console.log(`Attribute ${index + 1}:`, attributeData);
        return attributeData;
      });

      const { data: insertedAttrs, error: attrError } = await supabase
        .from("sample_attributes")
        .insert(attributes)
        .select();

      if (attrError) {
        console.error("Error creating sample attributes:", attrError);
        console.error("Failed attributes data:", attributes);
        // Return error instead of silently failing
        return NextResponse.json(
          { error: `Failed to create sample attributes: ${attrError.message}` },
          { status: 500 }
        );
      }
      
      console.log('Successfully inserted attributes:', insertedAttrs);
    } else {
      console.log('No attributes to save');
    }

    // Fetch the complete sample data with attributes
    const { data: fullSample } = await supabase
      .from("samples")
      .select(`
        *,
        attributes:sample_attributes(
          attribute_name,
          attribute_value,
          attribute_unit,
          vendor_id,
          display_order
        )
      `)
      .eq("id", sample.id)
      .single();

    return NextResponse.json({ sample: fullSample || sample }, { status: 201 });

  } catch (error) {
    console.error("Error in samples POST API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sampleId = searchParams.get("id");

    if (!sampleId) {
      return NextResponse.json({ error: "Sample ID is required" }, { status: 400 });
    }

    // Get the current user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify sample belongs to organization
    const { data: existingSample } = await supabase
      .from("samples")
      .select("*")
      .eq("id", sampleId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!existingSample) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: any = {};

    // Handle basic field updates
    if (body.name !== undefined) updates.name = body.name;
    if (body.quantity !== undefined) updates.quantity = parseInt(body.quantity);
    if (body.size !== undefined) updates.size = body.size;
    if (body.location !== undefined) updates.location = body.location;

    // SKU updates not allowed after creation for data integrity

    // Update the sample
    const { data: updatedSample, error: updateError } = await supabase
      .from("samples")
      .update(updates)
      .eq("id", sampleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating sample:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update sample" },
        { status: 500 }
      );
    }

    // Handle attributes updates
    if (body.attributes !== undefined) {
      console.log('Updating attributes for sample:', sampleId);
      console.log('New attributes:', body.attributes);
      
      // Delete existing attributes
      const { error: deleteError } = await supabase
        .from("sample_attributes")
        .delete()
        .eq("sample_id", sampleId);
        
      if (deleteError) {
        console.error("Error deleting existing attributes:", deleteError);
        return NextResponse.json(
          { error: `Failed to delete existing attributes: ${deleteError.message}` },
          { status: 500 }
        );
      }

      // Insert new attributes
      if (body.attributes.length > 0) {
        const attributes = body.attributes.map((attr: any, index: number) => {
          const attributeData = {
            sample_id: sampleId,
            attribute_category: 'general',
            attribute_name: attr.attribute_name,
            attribute_value: attr.attribute_value,
            attribute_unit: null,
            vendor_id: attr.vendor_id && attr.vendor_id.trim() !== '' ? attr.vendor_id : null,
            display_order: index
          };
          console.log(`Update Attribute ${index + 1}:`, attributeData);
          return attributeData;
        });

        const { data: insertedAttrs, error: attrError } = await supabase
          .from("sample_attributes")
          .insert(attributes)
          .select();
          
        if (attrError) {
          console.error("Error creating updated attributes:", attrError);
          console.error("Failed attributes data:", attributes);
          return NextResponse.json(
            { error: `Failed to create updated attributes: ${attrError.message}` },
            { status: 500 }
          );
        }
        
        console.log('Successfully updated attributes:', insertedAttrs);
      } else {
        console.log('No attributes to save in update');
      }
    }

    // Fetch the complete updated sample data with attributes
    const { data: fullSample } = await supabase
      .from("samples")
      .select(`
        *,
        attributes:sample_attributes(
          attribute_name,
          attribute_value,
          attribute_unit,
          vendor_id,
          display_order
        )
      `)
      .eq("id", sampleId)
      .single();

    return NextResponse.json({ sample: fullSample || updatedSample });

  } catch (error) {
    console.error("Error in samples PUT API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sampleId = searchParams.get("id");

    if (!sampleId) {
      return NextResponse.json({ error: "Sample ID is required" }, { status: 400 });
    }

    // Get the current user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify sample belongs to organization
    const { data: existingSample } = await supabase
      .from("samples")
      .select("*")
      .eq("id", sampleId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!existingSample) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }

    // Delete sample attributes first (due to foreign key constraint)
    await supabase
      .from("sample_attributes")
      .delete()
      .eq("sample_id", sampleId);

    // Delete sample images if any
    await supabase
      .from("sample_images")
      .delete()
      .eq("sample_id", sampleId);

    // Delete the sample
    const { error: deleteError } = await supabase
      .from("samples")
      .delete()
      .eq("id", sampleId);

    if (deleteError) {
      console.error("Error deleting sample:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete sample" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Sample deleted successfully" });

  } catch (error) {
    console.error("Error in samples DELETE API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}