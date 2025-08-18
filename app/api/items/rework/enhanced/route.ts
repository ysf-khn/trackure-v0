// // DISABLE AND DELETE

// import { NextResponse } from "next/server";
// import { z } from "zod";
// import { createClient } from "@/utils/supabase/server";

// // Enhanced rework request schema
// const enhancedReworkSchema = z.object({
//   items: z
//     .array(
//       z.object({
//         id: z.string().uuid(),
//         quantity: z.number().positive("Quantity must be a positive number."),
//         rework_type: z.enum(['backward', 'scrapped', 'replaced']),
//         target_stage_id: z.string().uuid().optional(), // Required for backward moves
//       })
//     )
//     .min(1, "At least one item is required."),
//   rework_reason: z.string().min(1, "Rework reason is required."),
//   create_replacements: z.boolean().default(false), // For scrapped items
//   preserve_total_quantity: z.boolean().default(true), // Whether to maintain order quantities
// });

// export async function POST(request: Request) {
//   const supabase = await createClient();

//   // Get the authenticated user
//   const {
//     data: { user },
//     error: userError,
//   } = await supabase.auth.getUser();

//   if (userError || !user) {
//     console.error("Enhanced Rework: Authentication error:", userError);
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // Parse and validate the request body
//   let body;
//   try {
//     body = await request.json();
//   } catch (parseError) {
//     console.error("Enhanced Rework: JSON parsing error:", parseError);
//     return NextResponse.json(
//       { error: "Invalid JSON in request body" },
//       { status: 400 }
//     );
//   }

//   // Validate the request body against the schema
//   const validationResult = enhancedReworkSchema.safeParse(body);
//   if (!validationResult.success) {
//     console.error("Enhanced Rework: Validation error:", validationResult.error);
//     return NextResponse.json(
//       {
//         error: "Invalid request body",
//         details: validationResult.error.errors,
//       },
//       { status: 400 }
//     );
//   }

//   const { items, rework_reason, create_replacements, preserve_total_quantity } =
//     validationResult.data;

//   // Fetch user profile to get organization_id and role
//   const { data: profile, error: profileError } = await supabase
//     .from("profiles")
//     .select("organization_id, role")
//     .eq("id", user.id)
//     .single();

//   if (profileError || !profile) {
//     console.error("Enhanced Rework Profile Error:", profileError);
//     return NextResponse.json(
//       { error: "User profile not found or error fetching it." },
//       { status: 403 }
//     );
//   }

//   // RBAC Check: Ensure user role has permission
//   if (profile.role === "Worker") {
//     const { data: hasPermission, error: permissionError } = await supabase.rpc(
//       "worker_has_permission",
//       {
//         permission_key: "items.rework",
//       }
//     );

//     if (permissionError) {
//       console.error("Error checking rework permissions:", permissionError);
//       return NextResponse.json(
//         { error: "Failed to verify permissions" },
//         { status: 500 }
//       );
//     }

//     if (!hasPermission) {
//       return NextResponse.json(
//         { error: "Forbidden: You don't have permission to rework items" },
//         { status: 403 }
//       );
//     }
//   } else if (!["Owner", "Worker"].includes(profile.role)) {
//     return NextResponse.json(
//       { error: "Forbidden: Insufficient permissions." },
//       { status: 403 }
//     );
//   }

//   const organizationId = profile.organization_id;

//   try {
//     // Call the enhanced_rework_items database function
//     const { data: reworkResults, error: reworkError } = await supabase.rpc(
//       "enhanced_rework_items",
//       {
//         p_items: JSON.stringify(items),
//         p_rework_reason: rework_reason,
//         p_create_replacements: create_replacements,
//       }
//     );

//     if (reworkError) {
//       console.error("Enhanced Rework Database Error:", reworkError);
//       return NextResponse.json(
//         { error: "Failed to process rework items", details: reworkError },
//         { status: 500 }
//       );
//     }

//     // Process results
//     const successfulItems = reworkResults.filter((r: any) => r.success);
//     const failedItems = reworkResults.filter((r: any) => !r.success);

//     // Update order quantities if not preserving total quantity
//     if (!preserve_total_quantity) {
//       const scrappedItems = successfulItems.filter(
//         (r: any) => r.action_type === 'scrapped'
//       );

//       for (const scrappedItem of scrappedItems) {
//         // Get the item details to find order_id and quantity
//         const { data: itemDetails } = await supabase
//           .from("items")
//           .select("order_id, total_quantity")
//           .eq("id", scrappedItem.item_id)
//           .single();

//         if (itemDetails && itemDetails.order_id) {
//           // Reduce order total quantity
//           const itemToScrap = items.find(i => i.id === scrappedItem.item_id);
//           if (itemToScrap) {
//             await supabase
//               .from("orders")
//               .update({
//                 total_quantity: supabase.sql`total_quantity - ${itemToScrap.quantity}`,
//                 updated_at: new Date().toISOString(),
//               })
//               .eq("id", itemDetails.order_id);
//           }
//         }
//       }
//     }

//     // Determine response status
//     const status = failedItems.length === 0 ? 200 :
//                   successfulItems.length === 0 ? 500 : 207; // Multi-status

//     // Format response
//     const response = {
//       message: `Processed ${items.length} items. Success: ${successfulItems.length}, Failures: ${failedItems.length}.`,
//       results: successfulItems.map((r: any) => ({
//         itemId: r.item_id,
//         actionType: r.action_type,
//         newStageId: r.new_stage_id,
//         replacementId: r.replacement_id,
//         message: r.message,
//       })),
//       ...(failedItems.length > 0 && {
//         errors: failedItems.map((r: any) => ({
//           itemId: r.item_id,
//           actionType: r.action_type,
//           error: r.message,
//         })),
//       }),
//     };

//     return NextResponse.json(response, { status });

//   } catch (error) {
//     console.error("Enhanced Rework Unhandled Error:", error);
//     return NextResponse.json(
//       { error: "An unexpected server error occurred." },
//       { status: 500 }
//     );
//   }
// }

// // GET endpoint to get rework options for an item
// export async function GET(request: Request) {
//   const supabase = await createClient();
//   const { searchParams } = new URL(request.url);
//   const itemId = searchParams.get('item_id');

//   if (!itemId) {
//     return NextResponse.json(
//       { error: "item_id parameter is required" },
//       { status: 400 }
//     );
//   }

//   // Get the authenticated user
//   const {
//     data: { user },
//     error: userError,
//   } = await supabase.auth.getUser();

//   if (userError || !user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     // Get item details and current allocation
//     const { data: itemData, error: itemError } = await supabase
//       .from("items")
//       .select(`
//         id,
//         sku,
//         total_quantity,
//         organization_id,
//         order_id,
//         is_scrapped,
//         current_allocation:item_stage_allocations!inner(
//           id,
//           stage_id,
//           quantity,
//           stage:workflow_stages(
//             id,
//             name,
//             full_path,
//             sequence_order
//           )
//         )
//       `)
//       .eq("id", itemId)
//       .single();

//     if (itemError || !itemData) {
//       return NextResponse.json(
//         { error: "Item not found or error fetching item details" },
//         { status: 404 }
//       );
//     }

//     if (itemData.is_scrapped) {
//       return NextResponse.json(
//         { error: "Item is already scrapped" },
//         { status: 400 }
//       );
//     }

//     // Get available previous stages for backward rework
//     const { data: allStages, error: stagesError } = await supabase
//       .from("workflow_stages")
//       .select(`
//         id,
//         name,
//         full_path,
//         sequence_order,
//         is_leaf_stage,
//         sku
//       `)
//       .eq("organization_id", itemData.organization_id)
//       .eq("is_leaf_stage", true)
//       .order("sequence_order");

//     if (stagesError) {
//       return NextResponse.json(
//         { error: "Failed to fetch workflow stages" },
//         { status: 500 }
//       );
//     }

//     // Filter stages that are before current stage (for backward movement)
//     const currentStageOrder = itemData.current_allocation[0]?.stage?.sequence_order || 0;
//     const availableBackwardStages = allStages
//       .filter(stage =>
//         stage.sequence_order < currentStageOrder &&
//         (stage.sku === itemData.sku || stage.sku === null)
//       )
//       .map(stage => ({
//         id: stage.id,
//         name: stage.name,
//         full_path: stage.full_path,
//         sequence_order: stage.sequence_order,
//       }));

//     const response = {
//       item: {
//         id: itemData.id,
//         sku: itemData.sku,
//         total_quantity: itemData.total_quantity,
//         current_stage: itemData.current_allocation[0]?.stage,
//         current_allocation_quantity: itemData.current_allocation[0]?.quantity,
//       },
//       rework_options: {
//         backward: {
//           available: availableBackwardStages.length > 0,
//           stages: availableBackwardStages,
//         },
//         scrapped: {
//           available: true,
//           can_create_replacement: true,
//           preserve_order_quantity: true,
//         },
//       },
//     };

//     return NextResponse.json(response);

//   } catch (error) {
//     console.error("Enhanced Rework GET Error:", error);
//     return NextResponse.json(
//       { error: "An unexpected server error occurred." },
//       { status: 500 }
//     );
//   }
// }
