"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

interface WorkerPermission {
  permission_key: string;
  enabled: boolean;
}

interface PermissionsContextType {
  permissions: WorkerPermission[];
  isLoading: boolean;
  error: string | null;
  hasPermission: (permissionKey: string) => boolean;
  invalidatePermissions: () => void;
  updatePermissions: (permissions: WorkerPermission[]) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);

// Query key factory for permissions
const permissionsKeys = {
  all: ["permissions"] as const,
  byOrg: (orgId: string) => [...permissionsKeys.all, orgId] as const,
  // Legacy key for backward compatibility
  legacy: (orgId: string) => ["permissions", orgId] as const,
};

// Fetch function for permissions
async function fetchPermissions(): Promise<WorkerPermission[]> {
  const response = await fetch("/api/settings/access-control", {
    headers: {
      "Cache-Control": "public, max-age=300", // 5 minutes
    },
  });

  if (!response.ok) {
    // If forbidden (403), return empty array - worker doesn't have access
    if (response.status === 403) {
      return [];
    }
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch permissions");
  }

  const data = await response.json();
  return data.permissions || [];
}

// Update function for permissions
async function updatePermissionsAPI(
  permissions: WorkerPermission[]
): Promise<void> {
  const response = await fetch("/api/settings/access-control", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      permissions,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update permissions");
  }
}

interface PermissionsProviderProps {
  children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { profile, organizationId } = useProfileAndOrg();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Query for permissions with aggressive caching
  const {
    data: permissions = [],
    isLoading,
    error: queryError,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: permissionsKeys.byOrg(organizationId || ""),
    queryFn: fetchPermissions,
    enabled: !!(organizationId && profile), // Only fetch when we have org and profile
    staleTime: 10 * 60 * 1000, // 10 minutes - permissions rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: (failureCount, error) => {
      // Don't retry on 403 errors (forbidden)
      if (
        error?.message?.includes("403") ||
        error?.message?.includes("Forbidden")
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Mutation for updating permissions
  const updateMutation = useMutation({
    mutationFn: updatePermissionsAPI,
    onMutate: async (newPermissions) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: permissionsKeys.byOrg(organizationId || ""),
      });

      // Snapshot the previous value
      const previousPermissions = queryClient.getQueryData(
        permissionsKeys.byOrg(organizationId || "")
      );

      // Optimistically update to the new value
      queryClient.setQueryData(
        permissionsKeys.byOrg(organizationId || ""),
        newPermissions
      );

      // Return a context object with the snapshotted value
      return { previousPermissions };
    },
    onError: (error, newPermissions, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        permissionsKeys.byOrg(organizationId || ""),
        context?.previousPermissions
      );
      console.error("Error updating permissions:", error);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: permissionsKeys.all,
      });
      // Also invalidate legacy keys for compatibility
      queryClient.invalidateQueries({
        queryKey: permissionsKeys.legacy(organizationId || ""),
      });
    },
  });

  // Set up SSE connection for real-time permission updates
  useEffect(() => {
    if (!organizationId || !profile) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new SSE connection
    const eventSource = new EventSource(
      `/api/permissions/stream/${organizationId}`
    );
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("Permission SSE connection opened");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "permissions_updated") {
          console.log("Received permission update via SSE");
          // Immediately invalidate and refetch permissions
          queryClient.invalidateQueries({
            queryKey: permissionsKeys.byOrg(organizationId),
          });
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      // Optionally implement exponential backoff retry logic here
    };

    // Cleanup on unmount or dependency change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [organizationId, profile?.id, queryClient]);

  const hasPermission = (permissionKey: string): boolean => {
    // Owners always have all permissions
    if (profile?.role === "Owner") return true;

    // For workers, check the specific permission
    if (profile?.role === "Worker") {
      const permission = permissions.find(
        (p) => p.permission_key === permissionKey
      );
      return permission?.enabled || false;
    }

    // Default deny for unknown roles
    return false;
  };

  const invalidatePermissions = () => {
    queryClient.invalidateQueries({
      queryKey: permissionsKeys.byOrg(organizationId || ""),
    });
  };

  const updatePermissions = async (
    newPermissions: WorkerPermission[]
  ): Promise<boolean> => {
    if (!organizationId || !profile || profile.role !== "Owner") return false;

    try {
      await updateMutation.mutateAsync(newPermissions);
      return true;
    } catch (error) {
      console.error("Error updating permissions:", error);
      return false;
    }
  };

  const refetch = async () => {
    await refetchQuery();
  };

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const value: PermissionsContextType = {
    permissions,
    isLoading: isLoading || updateMutation.isPending,
    error: queryError?.message || updateMutation.error?.message || null,
    hasPermission,
    invalidatePermissions,
    updatePermissions,
    refetch,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

// Hook to use permissions context
export function usePermissions(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

// Convenience hook for quick permission checks
export function useHasPermission(permissionKey: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permissionKey);
}

// Backward compatibility - replace useWorkerPermissions with this
export function useWorkerPermissions() {
  return usePermissions();
}
