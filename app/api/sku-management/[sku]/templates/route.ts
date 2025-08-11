import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params;
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

    // Get all workflow templates for this SKU (including inactive ones for history)
    const { data: templates, error: templatesError } = await supabase
      .from("workflow_templates")
      .select(`
        id,
        name,
        description,
        is_active,
        completed_count,
        avg_completion_days,
        created_at,
        updated_at,
        created_by,
        stages:workflow_template_stages(
          id,
          name,
          sequence_order,
          depth_level,
          is_leaf_stage,
          location,
          avg_time_hours,
          vendor_pricing:workflow_template_vendor_pricing(
            id,
            vendor_id,
            vendor_name,
            vendor_firm_name,
            price,
            currency,
            price_unit,
            minimum_quantity,
            lead_time_days,
            notes
          )
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }

    // Get current workflow stages for this SKU
    const { data: currentWorkflowStages, error: workflowError } = await supabase
      .from("workflow_stages")
      .select(`
        id,
        name,
        sequence_order,
        depth_level,
        is_leaf_stage,
        location,
        parent_stage_id
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .order("sequence_order");

    if (workflowError) {
      console.error("Error fetching current workflow:", workflowError);
    }

    // Get vendor pricing for current workflow
    const { data: vendorPricing, error: vendorError } = await supabase
      .from("vendor_stage_pricing")
      .select(`
        id,
        stage_id,
        vendor_id,
        price,
        currency,
        lead_time_days,
        is_active,
        vendors(
          id,
          name,
          firm_name
        ),
        workflow_stages(
          name
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true);

    if (vendorError) {
      console.error("Error fetching vendor pricing:", vendorError);
    }

    // Get template usage statistics (which orders used which templates)
    const { data: templateUsage, error: usageError } = await supabase
      .from("items")
      .select(`
        id,
        order_id,
        created_at,
        orders!inner(
          order_number,
          customer_name
        )
      `)
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .eq("workflow_type", "sku");

    if (usageError) {
      console.error("Error fetching template usage:", usageError);
    }

    // Calculate template performance metrics
    const templatesWithMetrics = templates?.map(template => ({
      ...template,
      usage_orders: templateUsage?.length || 0,
      performance_score: template.completed_count > 0 
        ? Math.round((template.completed_count / (template.completed_count + 1)) * 100)
        : 0
    })) || [];

    return NextResponse.json({
      templates: templatesWithMetrics,
      current_workflow: {
        stages: currentWorkflowStages || [],
        vendor_pricing: vendorPricing || []
      },
      template_usage_stats: {
        total_orders_using_templates: templateUsage?.length || 0,
        active_template: templates?.find(t => t.is_active) || null
      }
    });

  } catch (error) {
    console.error("Error in SKU templates API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params;
    const { name, description, includeVendorPricing = true } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

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

    // Check if current workflow exists for this SKU
    const { data: workflowStages, error: workflowError } = await supabase
      .from("workflow_stages")
      .select("id")
      .eq("sku", sku)
      .eq("organization_id", profile.organization_id)
      .limit(1);

    if (workflowError) {
      console.error("Error checking workflow:", workflowError);
      return NextResponse.json({ error: "Failed to check existing workflow" }, { status: 500 });
    }

    if (!workflowStages || workflowStages.length === 0) {
      return NextResponse.json({ error: "No workflow found for this SKU. Please configure a workflow first." }, { status: 400 });
    }

    // Create template from current workflow using our utility function
    const { data: templateId, error: templateError } = await supabase.rpc('create_workflow_template_from_current', {
      p_sku: sku,
      p_organization_id: profile.organization_id,
      p_name: name,
      p_description: description || null,
      p_include_vendor_pricing: includeVendorPricing
    });

    if (templateError) {
      console.error("Error creating template:", templateError);
      
      // If the RPC doesn't exist, fall back to manual creation
      if (templateError.code === '42883') { // undefined function
        return await createTemplateManually(supabase, sku, profile.organization_id, name, description, includeVendorPricing);
      }
      
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
    }

    return NextResponse.json({ 
      template_id: templateId,
      message: "Template created successfully" 
    });

  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Fallback function to create template manually if RPC doesn't exist
async function createTemplateManually(supabase: any, sku: string, organizationId: string, name: string, description?: string, includeVendorPricing: boolean = true) {
  try {
    // Deactivate any existing active template for this SKU
    await supabase
      .from('workflow_templates')
      .update({ is_active: false })
      .eq('organization_id', organizationId)
      .eq('sku', sku)
      .eq('is_active', true);
    
    // Create new template
    const { data: newTemplate, error: insertError } = await supabase
      .from('workflow_templates')
      .insert({
        organization_id: organizationId,
        sku: sku,
        name: name,
        description: description,
        is_active: true,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Get current workflow stages and copy them to template stages
    const { data: stages, error: stagesError } = await supabase
      .from('workflow_stages')
      .select('*')
      .eq('sku', sku)
      .eq('organization_id', organizationId)
      .order('sequence_order');

    if (stagesError) throw stagesError;

    // Copy stages to template stages
    const templateStages = stages?.map(stage => ({
      template_id: newTemplate.id,
      original_stage_id: stage.id,
      parent_stage_id: null, // We'll handle this in a second pass
      name: stage.name,
      sequence_order: stage.sequence_order,
      depth_level: stage.depth_level,
      full_path: stage.full_path,
      is_leaf_stage: stage.is_leaf_stage,
      location: stage.location
    }));

    let insertedTemplateStages: any[] = [];
    if (templateStages && templateStages.length > 0) {
      const { data: insertedStages, error: templateStagesError } = await supabase
        .from('workflow_template_stages')
        .insert(templateStages)
        .select('id, original_stage_id');

      if (templateStagesError) throw templateStagesError;
      insertedTemplateStages = insertedStages || [];
    }

    // Copy vendor pricing if requested
    if (includeVendorPricing && insertedTemplateStages.length > 0) {
      for (const templateStage of insertedTemplateStages) {
        // Get vendor pricing for the original stage
        const { data: vendorPricing, error: vendorPricingError } = await supabase
          .from('vendor_stage_pricing')
          .select(`
            *,
            vendors!inner(
              name,
              firm_name
            )
          `)
          .eq('stage_id', templateStage.original_stage_id)
          .eq('sku', sku)
          .eq('organization_id', organizationId)
          .eq('is_active', true);

        if (vendorPricingError) {
          console.error('Error fetching vendor pricing:', vendorPricingError);
          continue;
        }

        if (vendorPricing && vendorPricing.length > 0) {
          const templateVendorPricing = vendorPricing.map(vp => ({
            template_id: newTemplate.id,
            template_stage_id: templateStage.id,
            original_vendor_pricing_id: vp.id,
            vendor_id: vp.vendor_id,
            vendor_name: vp.vendors.name,
            vendor_firm_name: vp.vendors.firm_name,
            price: vp.price,
            currency: vp.currency,
            price_unit: vp.price_unit,
            minimum_quantity: vp.minimum_quantity,
            lead_time_days: vp.lead_time_days,
            notes: vp.notes
          }));

          const { error: vendorPricingInsertError } = await supabase
            .from('workflow_template_vendor_pricing')
            .insert(templateVendorPricing);

          if (vendorPricingInsertError) {
            console.error('Error inserting template vendor pricing:', vendorPricingInsertError);
          }
        }
      }
    }

    return NextResponse.json({ 
      template_id: newTemplate.id,
      message: "Template created successfully" 
    });

  } catch (error) {
    console.error("Error in manual template creation:", error);
    return NextResponse.json({ error: "Failed to create template manually" }, { status: 500 });
  }
}