import { NextRequest, NextResponse } from "next/server";

/**
 * API route for packaging reminder checks - DISABLED (Coming Soon)
 * This functionality has been temporarily disabled and will be available in a future update
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      message: "Packaging reminders functionality is coming soon",
      error:
        "This feature is currently disabled and will be available in a future update",
    },
    { status: 503 } // Service Unavailable
  );
}

/**
 * GET endpoint for testing/health check
 */
export async function GET() {
  return NextResponse.json({
    message: "Packaging reminder check endpoint is available",
    usage: "POST to this endpoint to trigger a reminder check",
    requiredHeaders: {
      Authorization:
        "Bearer YOUR_API_KEY (if PACKAGING_REMINDER_API_KEY is set)",
    },
  });
}
