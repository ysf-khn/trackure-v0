import { NextResponse } from "next/server";
import { cleanupExpiredCancelledSubscriptions } from "../../webhooks/dodo/route";

export async function POST(request: Request) {
  try {
    // Verify this is an internal call (you might want to add authentication here)
    const authHeader = request.headers.get("authorization");
    const expectedToken =
      process.env.INTERNAL_API_TOKEN || "your-internal-token";

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await cleanupExpiredCancelledSubscriptions();

    return NextResponse.json(
      { message: "Cleanup completed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during subscription cleanup:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// You can also add a GET method for manual testing
export async function GET() {
  return NextResponse.json(
    {
      message: "Subscription cleanup endpoint",
      usage: "POST with Bearer token to run cleanup",
    },
    { status: 200 }
  );
}
