import { createClient } from "@/utils/supabase/server";
import { getUserWithProfile } from "@/utils/supabase/queries";
import { NextRequest } from "next/server";
import { addConnection, removeConnection } from "@/lib/permissions-stream";

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
      addConnection(orgId, controller);

      // Send initial connection confirmation
      controller.enqueue(
        `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`
      );

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        removeConnection(orgId, controller);
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
