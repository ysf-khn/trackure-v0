import { NextResponse } from "next/server";
import { getWorkflowStructure } from "@/lib/queries/workflow";
import { type WorkflowStructure } from "@/lib/queries/workflow"; // Import the type
import { createClient } from "@/utils/supabase/server";
export const dynamic = "force-dynamic"; // Ensure it runs dynamically per request

export async function GET() {
  // Create the server client directly in the route handler
  const supabase = await createClient();

  try {
    // Pass the created client to the function
    const workflowData: WorkflowStructure =
      await getWorkflowStructure(supabase);
    return NextResponse.json(workflowData);
  } catch (error) {
    console.error("API Error fetching workflow:", error);
    // Determine a more specific error message if possible
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to fetch workflow structure";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
