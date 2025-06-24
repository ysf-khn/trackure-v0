import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";
import { NextRequest } from "next/server";

// Keep track of active SSE connections per organization
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const supabase = await createClient();
  const {
    user,
    profile,
    error: userProfileError,
  } = await getUserWithProfile(supabase);

  if (
    userProfileError ||
    !user ||
    !profile?.organization_id ||
    !profile?.role
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (profile.organization_id !== orgId) {
    return new Response("Forbidden", { status: 403 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the org's connection set
      if (!connections.has(orgId)) {
        connections.set(orgId, new Set());
      }
      connections.get(orgId)!.add(controller);

      // Send initial connection confirmation
      controller.enqueue(
        `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`
      );

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        const orgConnections = connections.get(orgId);
        if (orgConnections) {
          orgConnections.delete(controller);
          if (orgConnections.size === 0) {
            connections.delete(orgId);
          }
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}

// Function to broadcast permission updates to all connections for an organization
export function broadcastPermissionUpdate(orgId: string, permissions: any[]) {
  const orgConnections = connections.get(orgId);
  if (!orgConnections || orgConnections.size === 0) return;

  const message = `data: ${JSON.stringify({
    type: "permissions_updated",
    permissions,
    timestamp: Date.now(),
  })}\n\n`;

  // Send to all active connections for this org
  orgConnections.forEach((controller) => {
    try {
      controller.enqueue(message);
    } catch (error) {
      // Remove broken connections
      orgConnections.delete(controller);
    }
  });
}
