import { createClient } from "@/utils/supabase/server";
import {
  sendPackagingReminder,
  type EmailRecipient,
  type PackagingReminderData,
} from "./email/packaging-reminder";

// Configurable percentage threshold (can be moved to organization settings later)
const REMINDER_PERCENTAGE_THRESHOLD = 75;

interface OrderWithReminder {
  id: string;
  order_number: string;
  organization_id: string;
  required_packaging_materials: string[];
  total_quantity: number;
  packaging_reminder_trigger_stage_id: string | null;
  packaging_reminder_trigger_sub_stage_id: string | null;
  trigger_stage_name?: string;
  trigger_sub_stage_name?: string;
  organization_name?: string;
}

interface OwnerProfile {
  id: string;
  full_name: string | null;
  user_email: string;
}

/**
 * Main function to check and send packaging reminders
 * This should be called by a scheduled job (cron, edge function, etc.)
 */
export async function checkAndSendPackagingReminders(): Promise<{
  success: boolean;
  processedOrders: number;
  remindersSent: number;
  errors: string[];
}> {
  console.log("🔍 Starting packaging reminder check...");

  const errors: string[] = [];
  let processedOrders = 0;
  let remindersSent = 0;

  try {
    const supabase = await createClient();

    // Step 1: Get all orders that need reminder checking
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

    console.log(
      `📋 Found ${ordersToCheck.length} orders to check for packaging reminders`
    );

    // Step 2: Process each order
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
              `No owners found for organization ${order.organization_id}, order ${order.order_number}`
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
          console.log(
            `✅ Sent packaging reminder for order ${order.order_number} (${shouldSendReminder.percentageReached}% complete)`
          );
        }
      } catch (orderError) {
        const errorMsg = `Error processing order ${order.order_number}: ${orderError instanceof Error ? orderError.message : "Unknown error"}`;
        errors.push(errorMsg);
        console.error("❌", errorMsg);
      }
    }

    console.log(
      `✅ Packaging reminder check completed. Processed: ${processedOrders}, Sent: ${remindersSent}, Errors: ${errors.length}`
    );

    return {
      success: errors.length === 0,
      processedOrders,
      remindersSent,
      errors,
    };
  } catch (error) {
    const errorMsg = `Fatal error in packaging reminder check: ${error instanceof Error ? error.message : "Unknown error"}`;
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

/**
 * Get orders that need reminder checking (haven't been sent yet and have trigger configured)
 */
async function getOrdersNeedingReminderCheck(
  supabase: any
): Promise<OrderWithReminder[]> {
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
    throw new Error(
      `Failed to fetch orders needing reminder check: ${error.message}`
    );
  }

  return (data || []).map((order: any) => ({
    ...order,
    trigger_stage_name: order.trigger_stage?.name,
    trigger_sub_stage_name: order.trigger_sub_stage?.name,
    organization_name: order.organization?.name,
  }));
}

/**
 * Check if a reminder should be sent for a specific order based on item progression
 */
async function checkIfReminderShouldBeSent(
  supabase: any,
  order: OrderWithReminder
): Promise<{ send: boolean; percentageReached?: number }> {
  if (order.total_quantity === 0) {
    return { send: false };
  }

  // Build the query to count items that have reached the trigger stage/sub-stage
  let query = supabase
    .from("item_stage_allocations")
    .select("quantity", { count: "exact" })
    .eq("organization_id", order.organization_id)
    .in(
      "item_id",
      supabase.from("items").select("id").eq("order_id", order.id)
    );

  // Add stage/sub-stage filter based on what's configured
  if (order.packaging_reminder_trigger_sub_stage_id) {
    // If sub-stage is specified, check for that specific sub-stage
    query = query.eq(
      "sub_stage_id",
      order.packaging_reminder_trigger_sub_stage_id
    );
  } else if (order.packaging_reminder_trigger_stage_id) {
    // If only stage is specified, check for any allocation in that stage
    query = query.eq("stage_id", order.packaging_reminder_trigger_stage_id);
  } else {
    return { send: false };
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(
      `Failed to check item progression for order ${order.order_number}: ${error.message}`
    );
  }

  // Calculate total quantity of items that have reached the trigger point
  const itemsAtTrigger = (data || []).reduce(
    (sum: number, allocation: any) => sum + allocation.quantity,
    0
  );

  // Calculate percentage
  const percentageReached = Math.round(
    (itemsAtTrigger / order.total_quantity) * 100
  );

  console.log(
    `📊 Order ${order.order_number}: ${itemsAtTrigger}/${order.total_quantity} items at trigger (${percentageReached}%)`
  );

  return {
    send: percentageReached >= REMINDER_PERCENTAGE_THRESHOLD,
    percentageReached,
  };
}

/**
 * Get organization owners who should receive the reminder
 */
async function getOrganizationOwners(
  supabase: any,
  organizationId: string
): Promise<OwnerProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      user:auth.users!inner(email)
    `
    )
    .eq("organization_id", organizationId)
    .eq("role", "Owner");

  if (error) {
    throw new Error(`Failed to fetch organization owners: ${error.message}`);
  }

  return (data || [])
    .map((profile: any) => ({
      id: profile.id,
      full_name: profile.full_name,
      user_email: profile.user?.email,
    }))
    .filter((owner: OwnerProfile) => owner.user_email);
}

/**
 * Send the reminder email
 */
async function sendReminderEmail(
  order: OrderWithReminder,
  percentageReached: number,
  owners: OwnerProfile[]
): Promise<void> {
  const recipients: EmailRecipient[] = owners.map((owner) => ({
    email: owner.user_email,
    name: owner.full_name || undefined,
  }));

  const triggerName = order.trigger_sub_stage_name
    ? `${order.trigger_stage_name} > ${order.trigger_sub_stage_name}`
    : order.trigger_stage_name || "Unknown Stage";

  const reminderData: PackagingReminderData = {
    orderNumber: order.order_number,
    orderId: order.id,
    requiredPackagingMaterials: order.required_packaging_materials || [],
    triggerStageName: triggerName,
    percentageReached,
    organizationName: order.organization_name || "Your Organization",
  };

  await sendPackagingReminder(recipients, reminderData);
}

/**
 * Mark the reminder as sent for this order
 */
async function markReminderAsSent(
  supabase: any,
  orderId: string
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ packaging_reminder_sent: true })
    .eq("id", orderId);

  if (error) {
    throw new Error(
      `Failed to mark reminder as sent for order ${orderId}: ${error.message}`
    );
  }
}
