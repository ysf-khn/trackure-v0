import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku");

  const supabase = await createClient();

  // Get user session
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
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  try {
    // First, get all SKUs in the organization for the selector
    const { data: allSKUs, error: skuError } = await supabase
      .from("item_master")
      .select("sku")
      .eq("organization_id", profile.organization_id)
      .order("sku");

    if (skuError) {
      throw new Error(skuError.message);
    }

    // Get workflow stages for the specified SKU or organization
    let workflowQuery = supabase
      .from("workflow_stages")
      .select(`
        id,
        name,
        sequence_order,
        sku,
        parent_stage_id,
        depth_level,
        full_path,
        is_leaf_stage
      `)
      .eq("organization_id", profile.organization_id)
      .order("sequence_order");

    if (sku) {
      // Get SKU-specific workflow if it exists, otherwise fall back to organization workflow
      workflowQuery = workflowQuery.or(`sku.eq.${sku},sku.is.null`);
    } else {
      // Get organization-level workflow only
      workflowQuery = workflowQuery.is("sku", null);
    }

    const { data: workflowStages, error: workflowError } = await workflowQuery;

    if (workflowError) {
      throw new Error(workflowError.message);
    }

    // Get item counts for each stage
    const stageIds = workflowStages?.map(stage => stage.id) || [];
    let itemCountsData: any[] = [];

    if (stageIds.length > 0) {
      const { data: itemCounts, error: countError } = await supabase
        .from("item_stage_allocations")
        .select(`
          stage_id,
          quantity,
          items!inner(organization_id, sku)
        `)
        .in("stage_id", stageIds)
        .eq("items.organization_id", profile.organization_id);

      if (countError) {
        console.warn("Error fetching item counts:", countError);
      } else {
        itemCountsData = itemCounts || [];
      }
    }

    // Calculate item counts per stage
    const stageCounts = stageIds.reduce((acc, stageId) => {
      const stageItems = itemCountsData.filter(item => 
        item.stage_id === stageId && 
        (!sku || item.items.sku === sku)
      );
      acc[stageId] = stageItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      return acc;
    }, {} as Record<string, number>);

    // Build hierarchical tree structure
    const buildTree = (stages: any[], parentId: string | null = null): any[] => {
      return stages
        .filter(stage => stage.parent_stage_id === parentId)
        .map(stage => ({
          id: stage.id,
          name: stage.name,
          itemCount: stageCounts[stage.id] || 0,
          sku: stage.sku,
          sequence_order: stage.sequence_order,
          depth_level: stage.depth_level,
          full_path: stage.full_path,
          is_leaf_stage: stage.is_leaf_stage,
          subStages: buildTree(stages, stage.id),
        }))
        .sort((a, b) => a.sequence_order - b.sequence_order);
    };

    const hierarchicalStages = buildTree(workflowStages || []);

    // Convert to flat structure for backward compatibility if needed
    const flattenStages = (stages: any[]): any[] => {
      return stages.reduce((acc, stage) => {
        const { subStages, ...stageData } = stage;
        acc.push({
          ...stageData,
          subStages: subStages.length > 0 ? subStages : undefined,
        });
        return acc;
      }, []);
    };

    return NextResponse.json({
      stages: flattenStages(hierarchicalStages),
      availableSKUs: allSKUs?.map(item => ({
        value: item.sku,
        label: item.sku,
        itemCount: 0, // TODO: Calculate total item count per SKU
      })) || [],
      selectedSKU: sku,
    });

  } catch (error: unknown) {
    console.error("Error in SKU workflow API:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}