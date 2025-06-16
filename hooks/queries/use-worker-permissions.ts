import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import useProfileAndOrg from "./use-profileAndOrg";

interface WorkerPermission {
  permission_key: string;
  enabled: boolean;
}

interface UseWorkerPermissionsReturn {
  permissions: WorkerPermission[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updatePermissions: (permissions: WorkerPermission[]) => Promise<boolean>;
  hasPermission: (permissionKey: string) => boolean;
}

export default function useWorkerPermissions(): UseWorkerPermissionsReturn {
  const [permissions, setPermissions] = useState<WorkerPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile, organizationId } = useProfileAndOrg();

  const supabase = createClient();

  const fetchPermissions = async () => {
    if (!organizationId || !profile) return;

    try {
      setIsLoading(true);
      setError(null);

      // Only owners can fetch access control settings
      if (profile.role !== "Owner") {
        setError("Access denied: Only owners can view access control settings");
        return;
      }

      const response = await fetch("/api/settings/access-control");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch permissions");
      }

      const data = await response.json();
      setPermissions(data.permissions || []);
    } catch (e) {
      console.error("Error fetching permissions:", e);
      setError(e instanceof Error ? e.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePermissions = async (
    newPermissions: WorkerPermission[]
  ): Promise<boolean> => {
    if (!organizationId || !profile) return false;

    try {
      const response = await fetch("/api/settings/access-control", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissions: newPermissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update permissions");
      }

      // Update local state
      setPermissions(newPermissions);
      return true;
    } catch (e) {
      console.error("Error updating permissions:", e);
      setError(e instanceof Error ? e.message : "Failed to update permissions");
      return false;
    }
  };

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

    // Default deny
    return false;
  };

  useEffect(() => {
    fetchPermissions();
  }, [organizationId, profile]);

  return {
    permissions,
    isLoading,
    error,
    refetch: fetchPermissions,
    updatePermissions,
    hasPermission,
  };
}
