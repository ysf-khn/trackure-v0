// Keep track of active SSE connections per organization
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export function addConnection(
  orgId: string,
  controller: ReadableStreamDefaultController
) {
  if (!connections.has(orgId)) {
    connections.set(orgId, new Set());
  }
  connections.get(orgId)!.add(controller);
}

export function removeConnection(
  orgId: string,
  controller: ReadableStreamDefaultController
) {
  const orgConnections = connections.get(orgId);
  if (orgConnections) {
    orgConnections.delete(controller);
    if (orgConnections.size === 0) {
      connections.delete(orgId);
    }
  }
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
