"use client";

import React from "react";
// Removed unused imports: Skeleton, Alert, AlertDescription, AlertTitle, Terminal
import { WorkflowEditor } from "@/components/settings/workflow-editor";

interface WorkflowTabContentProps {
  organizationId: string; // Keep prop, might be needed by WorkflowEditor later, but mark as unused for now
}

export default function WorkflowTabContent({
  organizationId, // Mark as potentially unused with underscore
}: WorkflowTabContentProps) {
  // TODO: Pass organizationId to WorkflowEditor if/when its hook needs it
  // Currently organizationId is unused in this component.

  return (
    // Pass organizationId down to the editor component
    <WorkflowEditor organizationId={organizationId} />
  );
}
