"use client";

import {
  usePermissions,
  useHasPermission,
} from "@/components/providers/permissions-provider";

/**
 * Lightweight hook for checking specific permissions
 * Uses the global permissions context for better performance
 */
export function usePermissionCheck(permissionKey: string): boolean {
  return useHasPermission(permissionKey);
}

/**
 * Hook for accessing all permissions data
 * Use this when you need the full permissions context
 */
export function usePermissionsData() {
  return usePermissions();
}

/**
 * Hook for multiple permission checks
 * More efficient than calling usePermissionCheck multiple times
 */
export function useMultiplePermissions(
  permissionKeys: string[]
): Record<string, boolean> {
  const { hasPermission } = usePermissions();

  return permissionKeys.reduce(
    (acc, key) => {
      acc[key] = hasPermission(key);
      return acc;
    },
    {} as Record<string, boolean>
  );
}

export default usePermissionCheck;
