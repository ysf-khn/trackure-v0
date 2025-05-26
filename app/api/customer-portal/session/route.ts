import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { customer_id } = await request.json();

    if (!customer_id) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.NODE_ENV === "production"
        ? process.env.DODO_API_KEY_LIVE
        : process.env.DODO_API_KEY_TEST;
    if (!apiKey) {
      console.error("DODO_API_KEY is not configured");
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 }
      );
    }

    // Determine the base URL based on environment
    const baseUrl =
      process.env.NODE_ENV === "production"
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";

    const response = await fetch(
      `${baseUrl}/customers/${customer_id}/customer-portal/session`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("DodoPayments API error:", errorData);
      return NextResponse.json(
        { error: "Failed to create customer portal session" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({ link: data.link });
  } catch (error) {
    console.error("Error creating customer portal session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
