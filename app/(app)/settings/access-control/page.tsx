"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  ShieldCheck,
  Settings,
  Users,
  CreditCard,
  Workflow,
  Package,
  FileText,
  Download,
  Eye,
  Edit,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  RotateCcw,
} from "lucide-react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import useWorkerPermissions from "@/hooks/queries/use-worker-permissions";
import { toast } from "sonner";

// Define permission categories and their specific permissions
interface Permission {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  permissions: Permission[];
}

const AccessControlPage = () => {
  const { profile, organizationId, isLoading, error } = useProfileAndOrg();
  const {
    permissions: dbPermissions,
    isLoading: isLoadingPermissions,
    error: permissionsError,
    updatePermissions,
  } = useWorkerPermissions();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize permission state
  const [permissionCategories, setPermissionCategories] = useState<
    PermissionCategory[]
  >([
    {
      id: "workflow",
      name: "Workflow Management",
      description:
        "Control access to workflow configuration and stage management",
      icon: <Workflow className="h-4 w-4" />,
      permissions: [
        {
          id: "workflow.view",
          name: "View Workflow",
          description: "Can view workflow stages and structure",
          icon: <Eye className="h-4 w-4" />,
          enabled: true, // Workers can always view workflow
        },
        {
          id: "workflow.edit",
          name: "Edit Workflow",
          description: "Can add, edit, delete, and reorder workflow stages",
          icon: <Edit className="h-4 w-4" />,
          enabled: false, // Owners only by default
        },
      ],
    },
    {
      id: "items",
      name: "Item Management",
      description: "Control access to item operations and data",
      icon: <Package className="h-4 w-4" />,
      permissions: [
        {
          id: "items.view",
          name: "View Items",
          description: "Can view item lists and details",
          icon: <Eye className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "items.move",
          name: "Move Items",
          description: "Can move items forward and perform rework operations",
          icon: <Package className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "items.add",
          name: "Add Items",
          description: "Can add new items to orders",
          icon: <Plus className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "items.delete",
          name: "Delete Items",
          description: "Can delete items from orders",
          icon: <Trash2 className="h-4 w-4" />,
          enabled: false,
        },
      ],
    },
    {
      id: "orders",
      name: "Order Management",
      description: "Control access to order operations and payment status",
      icon: <FileText className="h-4 w-4" />,
      permissions: [
        {
          id: "orders.view",
          name: "View Orders",
          description: "Can view order lists and details",
          icon: <Eye className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "orders.create",
          name: "Create Orders",
          description: "Can create new orders",
          icon: <Plus className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "orders.edit",
          name: "Edit Orders",
          description: "Can edit order details",
          icon: <Edit className="h-4 w-4" />,
          enabled: false,
        },
        {
          id: "orders.payment_status",
          name: "Edit Payment Status",
          description: "Can update payment status of orders",
          icon: <CreditCard className="h-4 w-4" />,
          enabled: false, // Owners only
        },
      ],
    },
    {
      id: "documents",
      name: "Documents & Downloads",
      description: "Control access to vouchers, PDFs, and document generation",
      icon: <Download className="h-4 w-4" />,
      permissions: [
        {
          id: "documents.vouchers",
          name: "Download Vouchers",
          description: "Can download movement and rework vouchers",
          icon: <Download className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "documents.history",
          name: "View Item History",
          description:
            "Can view item movement history and generate history PDFs",
          icon: <FileText className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "documents.export",
          name: "Export Data",
          description: "Can export item and order data",
          icon: <Download className="h-4 w-4" />,
          enabled: false,
        },
      ],
    },
    {
      id: "team",
      name: "Team Management",
      description: "Control access to team member management",
      icon: <Users className="h-4 w-4" />,
      permissions: [
        {
          id: "team.view",
          name: "View Team",
          description: "Can view team members and their roles",
          icon: <Eye className="h-4 w-4" />,
          enabled: true,
        },
        {
          id: "team.invite",
          name: "Invite Members",
          description: "Can invite new team members",
          icon: <Plus className="h-4 w-4" />,
          enabled: false,
        },
        {
          id: "team.edit",
          name: "Edit Members",
          description: "Can edit team member details and roles",
          icon: <Edit className="h-4 w-4" />,
          enabled: false,
        },
        {
          id: "team.remove",
          name: "Remove Members",
          description: "Can remove team members",
          icon: <Trash2 className="h-4 w-4" />,
          enabled: false,
        },
      ],
    },
    {
      id: "settings",
      name: "Settings & Configuration",
      description: "Control access to organization settings and billing",
      icon: <Settings className="h-4 w-4" />,
      permissions: [
        {
          id: "settings.account",
          name: "Account Settings",
          description: "Can view and edit account settings",
          icon: <Settings className="h-4 w-4" />,
          enabled: false,
        },
        {
          id: "settings.billing",
          name: "Billing & Subscription",
          description: "Can view and manage billing information",
          icon: <CreditCard className="h-4 w-4" />,
          enabled: false, // Owners only
        },
        {
          id: "settings.organization",
          name: "Organization Settings",
          description: "Can edit organization details",
          icon: <Settings className="h-4 w-4" />,
          enabled: false,
        },
      ],
    },
  ]);

  // Update permission state when database permissions are loaded
  useEffect(() => {
    if (dbPermissions.length > 0) {
      setPermissionCategories((prev) =>
        prev.map((category) => ({
          ...category,
          permissions: category.permissions.map((permission) => {
            const dbPermission = dbPermissions.find(
              (p) => p.permission_key === permission.id
            );
            return {
              ...permission,
              enabled: dbPermission?.enabled ?? permission.enabled,
            };
          }),
        }))
      );
    }
  }, [dbPermissions]);

  // Check if user is owner
  const isOwner = profile?.role === "Owner";

  // Handle permission toggle
  const togglePermission = (categoryId: string, permissionId: string) => {
    setPermissionCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              permissions: category.permissions.map((permission) =>
                permission.id === permissionId
                  ? { ...permission, enabled: !permission.enabled }
                  : permission
              ),
            }
          : category
      )
    );
    setHasChanges(true);
  };

  // Handle save permissions
  const handleSavePermissions = async () => {
    if (!organizationId) return;

    setIsSaving(true);
    try {
      // Flatten all permissions into a single array
      const allPermissions = permissionCategories.flatMap((category) =>
        category.permissions.map((permission) => ({
          permission_key: permission.id,
          enabled: permission.enabled,
        }))
      );

      const success = await updatePermissions(allPermissions);

      if (success) {
        toast.success("Permissions Updated", {
          description:
            "Worker access permissions have been successfully updated.",
        });
        setHasChanges(false);
      } else {
        throw new Error("Failed to update permissions");
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update permissions. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset to defaults
  const handleResetToDefaults = () => {
    // Reset to default state (reload the initial state)
    window.location.reload();
  };

  // Loading state
  if (isLoading || isLoadingPermissions) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Access Control</h1>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-8 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || permissionsError || !organizationId) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Access Control</h1>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              {error ||
                permissionsError ||
                "Unable to load access control settings."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Non-owner access denied
  if (!isOwner) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Access Control</h1>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-8">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Only organization owners can manage access control settings.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-xl font-semibold">Access Control</h1>
                <p className="text-sm text-muted-foreground">
                  Manage what workers can access and modify in your organization
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Owner Only
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Important Information
            </CardTitle>
            <CardDescription>
              These settings control what workers in your organization can
              access and modify. Changes apply to all current and future
              workers. Owners always have full access to all features.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Permission Categories */}
        <div className="space-y-6">
          {permissionCategories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.icon}
                  {category.name}
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.permissions.map((permission, index) => (
                  <div key={permission.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {permission.icon}
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">
                            {permission.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={permission.enabled}
                        onCheckedChange={() =>
                          togglePermission(category.id, permission.id)
                        }
                        disabled={
                          // Some permissions are always enabled for workers
                          permission.id === "workflow.view" ||
                          permission.id === "items.view" ||
                          permission.id === "orders.view" ||
                          permission.id === "team.view"
                        }
                      />
                    </div>
                    {index < category.permissions.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleResetToDefaults}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
            )}
            <Button
              onClick={handleSavePermissions}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessControlPage;
