import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailRecipient {
  email: string;
  name?: string;
}

interface PackagingReminderData {
  orderNumber: string;
  orderId: string;
  requiredPackagingMaterials: string[];
  triggerStageName: string;
  percentageReached: number;
  organizationName: string;
}

const REMINDER_PERCENTAGE_THRESHOLD = 75;

serve(async (req) => {
  try {
    // Only allow POST requests for security
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check for authorization (optional but recommended)
    const authHeader = req.headers.get("authorization");
    const expectedKey = Deno.env.get("PACKAGING_REMINDER_API_KEY");

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("🔍 Edge Function: Starting packaging reminder check...");

    const result = await checkAndSendPackagingReminders();

    console.log(
      `✅ Edge Function completed. Processed: ${result.processedOrders}, Sent: ${result.remindersSent}`
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        processedOrders: result.processedOrders,
        remindersSent: result.remindersSent,
        errors: result.errors,
      }),
      {
        status: result.success ? 200 : 207,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Edge Function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

async function checkAndSendPackagingReminders() {
  const errors: string[] = [];
  let processedOrders = 0;
  let remindersSent = 0;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get orders that need reminder checking
    const ordersToCheck = await getOrdersNeedingReminderCheck(supabase);

    if (ordersToCheck.length === 0) {
      console.log("✅ No orders require packaging reminder checking");
      return {
        success: true,
        processedOrders: 0,
        remindersSent: 0,
        errors: [],
      };
    }

    console.log(`📋 Found ${ordersToCheck.length} orders to check`);

    // Process each order
    for (const order of ordersToCheck) {
      try {
        processedOrders++;

        const shouldSendReminder = await checkIfReminderShouldBeSent(
          supabase,
          order
        );

        if (shouldSendReminder.send) {
          const owners = await getOrganizationOwners(
            supabase,
            order.organization_id
          );

          if (owners.length === 0) {
            errors.push(
              `No owners found for organization ${order.organization_id}`
            );
            continue;
          }

          await sendReminderEmail(
            order,
            shouldSendReminder.percentageReached!,
            owners
          );
          await markReminderAsSent(supabase, order.id);

          remindersSent++;
          console.log(`✅ Sent reminder for order ${order.order_number}`);
        }
      } catch (orderError) {
        const errorMsg = `Error processing order ${order.order_number}: ${orderError instanceof Error ? orderError.message : "Unknown"}`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      processedOrders,
      remindersSent,
      errors,
    };
  } catch (error) {
    const errorMsg = `Fatal error: ${error instanceof Error ? error.message : "Unknown"}`;
    console.error("💥", errorMsg);
    errors.push(errorMsg);

    return {
      success: false,
      processedOrders,
      remindersSent,
      errors,
    };
  }
}

async function getOrdersNeedingReminderCheck(supabase: any) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      organization_id,
      required_packaging_materials,
      total_quantity,
      packaging_reminder_trigger_stage_id,
      packaging_reminder_trigger_sub_stage_id,
      trigger_stage:workflow_stages!packaging_reminder_trigger_stage_id(name),
      trigger_sub_stage:workflow_sub_stages!packaging_reminder_trigger_sub_stage_id(name),
      organization:organizations!organization_id(name)
    `
    )
    .eq("packaging_reminder_sent", false)
    .or(
      "packaging_reminder_trigger_stage_id.not.is.null,packaging_reminder_trigger_sub_stage_id.not.is.null"
    )
    .not("required_packaging_materials", "is", null)
    .gt("total_quantity", 0);

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (data || []).map((order: any) => ({
    ...order,
    trigger_stage_name: order.trigger_stage?.name,
    trigger_sub_stage_name: order.trigger_sub_stage?.name,
    organization_name: order.organization?.name,
  }));
}

async function checkIfReminderShouldBeSent(supabase: any, order: any) {
  if (order.total_quantity === 0) {
    return { send: false };
  }

  // Get items in this order that have reached the trigger stage/sub-stage
  const { data: items } = await supabase
    .from("items")
    .select("id")
    .eq("order_id", order.id);

  if (!items || items.length === 0) {
    return { send: false };
  }

  const itemIds = items.map((item: any) => item.id);

  let query = supabase
    .from("item_stage_allocations")
    .select("quantity")
    .in("item_id", itemIds);

  if (order.packaging_reminder_trigger_sub_stage_id) {
    query = query.eq(
      "sub_stage_id",
      order.packaging_reminder_trigger_sub_stage_id
    );
  } else if (order.packaging_reminder_trigger_stage_id) {
    query = query.eq("stage_id", order.packaging_reminder_trigger_stage_id);
  } else {
    return { send: false };
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check allocations: ${error.message}`);
  }

  const itemsAtTrigger = (data || []).reduce(
    (sum: number, allocation: any) => sum + allocation.quantity,
    0
  );
  const percentageReached = Math.round(
    (itemsAtTrigger / order.total_quantity) * 100
  );

  return {
    send: percentageReached >= REMINDER_PERCENTAGE_THRESHOLD,
    percentageReached,
  };
}

async function getOrganizationOwners(supabase: any, organizationId: string) {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .eq("role", "Owner");

  if (profileError) {
    throw new Error(`Failed to fetch profiles: ${profileError.message}`);
  }

  // Match profiles with user emails
  const owners =
    profiles
      ?.map((profile: any) => {
        const user = data.users.find((u: any) => u.id === profile.id);
        return user
          ? {
              id: profile.id,
              full_name: profile.full_name,
              user_email: user.email,
            }
          : null;
      })
      .filter(Boolean) || [];

  return owners;
}

async function sendReminderEmail(
  order: any,
  percentageReached: number,
  owners: any[]
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const recipients = owners.map((owner) => owner.user_email).join(",");

  const triggerName = order.trigger_sub_stage_name
    ? `${order.trigger_stage_name} > ${order.trigger_sub_stage_name}`
    : order.trigger_stage_name || "Unknown Stage";

  const materialsListHtml = (order.required_packaging_materials || [])
    .map(
      (material: string) => `<li style="margin-bottom: 8px;">${material}</li>`
    )
    .join("");

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📦 Packaging Reminder</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Order #${order.order_number}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
        <div style="background: #ffffff; padding: 25px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px;">Time to Order Packaging Materials!</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
            <strong>${percentageReached}%</strong> of items for Order #<strong>${order.order_number}</strong> have reached the 
            <strong>"${triggerName}"</strong> stage.
          </p>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Required Packaging Materials:</h3>
            <ul style="color: #475569; margin: 0; padding-left: 20px; line-height: 1.6;">
              ${materialsListHtml}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        Deno.env.get("RESEND_FROM_EMAIL") || "Trakure <noreply@trakure.com>",
      to: recipients.split(","),
      subject: `📦 Packaging Reminder: Order #${order.order_number} (${percentageReached}% Complete)`,
      html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to send email: ${response.status} ${errorData}`);
  }

  console.log(`📧 Email sent for order ${order.order_number}`);
}

async function markReminderAsSent(supabase: any, orderId: string) {
  const { error } = await supabase
    .from("orders")
    .update({ packaging_reminder_sent: true })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Failed to mark reminder as sent: ${error.message}`);
  }
}
