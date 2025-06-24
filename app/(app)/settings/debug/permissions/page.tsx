"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Database,
  Zap,
} from "lucide-react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createClient } from "@/utils/supabase/client";

export default function PermissionsDebugPage() {
  const {
    profile,
    organizationId,
    isLoading: profileLoading,
  } = useProfileAndOrg();
  const {
    permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
    hasPermission,
    refetch: refetchPermissions,
  } = usePermissions();

  const [testResults, setTestResults] = useState<
    Array<{
      test: string;
      status: "pass" | "fail" | "loading";
      message: string;
    }>
  >([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // All permission keys to test
  const allPermissions = [
    "workflow.view",
    "workflow.edit",
    "items.view",
    "items.move",
    "items.add",
    "items.delete",
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.payment_status",
    "documents.vouchers",
    "documents.history",
    "documents.export",
    "team.view",
    "team.invite",
    "team.edit",
    "team.remove",
    "settings.account",
    "settings.billing",
    "settings.organization",
  ];

  const runDatabaseTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    const results = [];

    const supabase = createClient();

    try {
      // Test 1: Database connection
      results.push({
        test: "Database Connection",
        status: "loading" as const,
        message: "Testing database connectivity...",
      });
      setTestResults([...results]);

      const { data: connTest, error: connError } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);

      if (connError) {
        results[results.length - 1] = {
          test: "Database Connection",
          status: "fail",
          message: `Database connection failed: ${connError.message}`,
        };
      } else {
        results[results.length - 1] = {
          test: "Database Connection",
          status: "pass",
          message: "Database connection successful",
        };
      }
      setTestResults([...results]);

      // Test 2: Profile data
      results.push({
        test: "Profile Data",
        status: "loading" as const,
        message: "Checking profile information...",
      });
      setTestResults([...results]);

      if (!profile) {
        results[results.length - 1] = {
          test: "Profile Data",
          status: "fail",
          message: "Profile data not loaded",
        };
      } else {
        results[results.length - 1] = {
          test: "Profile Data",
          status: "pass",
          message: `Profile loaded: ${profile.role} in org ${organizationId}`,
        };
      }
      setTestResults([...results]);

      // Test 3: Worker permissions table
      results.push({
        test: "Worker Permissions Table",
        status: "loading" as const,
        message: "Checking worker permissions table...",
      });
      setTestResults([...results]);

      const { data: permData, error: permError } = await supabase
        .from("worker_permissions")
        .select("permission_key, enabled")
        .eq("organization_id", organizationId);

      if (permError) {
        results[results.length - 1] = {
          test: "Worker Permissions Table",
          status: "fail",
          message: `Failed to fetch permissions: ${permError.message}`,
        };
      } else {
        results[results.length - 1] = {
          test: "Worker Permissions Table",
          status: "pass",
          message: `Found ${permData?.length || 0} permission records`,
        };
      }
      setTestResults([...results]);

      // Test 4: Database function test
      results.push({
        test: "Database Function Test",
        status: "loading" as const,
        message: "Testing worker_has_permission function...",
      });
      setTestResults([...results]);

      const { data: funcTest, error: funcError } = await supabase.rpc(
        "worker_has_permission",
        { permission_key: "items.view" }
      );

      if (funcError) {
        results[results.length - 1] = {
          test: "Database Function Test",
          status: "fail",
          message: `Function call failed: ${funcError.message}`,
        };
      } else {
        results[results.length - 1] = {
          test: "Database Function Test",
          status: "pass",
          message: `Function returned: ${funcTest}`,
        };
      }
      setTestResults([...results]);

      // Test 5: Frontend permissions
      results.push({
        test: "Frontend Permissions",
        status: "loading" as const,
        message: "Testing frontend permission checks...",
      });
      setTestResults([...results]);

      const frontendTest = hasPermission("items.view");
      results[results.length - 1] = {
        test: "Frontend Permissions",
        status: frontendTest ? "pass" : "fail",
        message: `Frontend hasPermission('items.view'): ${frontendTest}`,
      };
      setTestResults([...results]);

      // Test 6: API endpoint test
      results.push({
        test: "API Endpoint Test",
        status: "loading" as const,
        message: "Testing permissions API endpoint...",
      });
      setTestResults([...results]);

      const response = await fetch("/api/settings/access-control");
      if (!response.ok) {
        results[results.length - 1] = {
          test: "API Endpoint Test",
          status: "fail",
          message: `API call failed: ${response.status} ${response.statusText}`,
        };
      } else {
        const data = await response.json();
        results[results.length - 1] = {
          test: "API Endpoint Test",
          status: "pass",
          message: `API returned ${data.permissions?.length || 0} permissions`,
        };
      }
      setTestResults([...results]);
    } catch (error) {
      results.push({
        test: "Test Execution",
        status: "fail",
        message: `Test execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      setTestResults([...results]);
    }

    setIsRunningTests(false);
  };

  if (profileLoading || permissionsLoading) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Permissions Debug</h1>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading profile and permissions...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Permissions Debug</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Role:</strong> {profile?.role || "Unknown"}
              </div>
              <div>
                <strong>Organization ID:</strong> {organizationId || "Unknown"}
              </div>
              <div>
                <strong>User ID:</strong> {profile?.id || "Unknown"}
              </div>
              <div>
                <strong>Email:</strong> {profile?.email || "Unknown"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions Status
            </CardTitle>
            <CardDescription>
              Current permissions loaded from the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permissionsError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Permissions Error</AlertTitle>
                <AlertDescription>{permissionsError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <span>Permissions Loaded: {permissions.length}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={refetchPermissions}
                disabled={permissionsLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPermissions.map((permKey) => {
                const isAllowed = hasPermission(permKey);
                const dbPermission = permissions.find(
                  (p) => p.permission_key === permKey
                );

                return (
                  <div
                    key={permKey}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm">{permKey}</div>
                      <div className="text-xs text-muted-foreground">
                        DB:{" "}
                        {dbPermission
                          ? dbPermission.enabled
                            ? "enabled"
                            : "disabled"
                          : "not found"}
                      </div>
                    </div>
                    <Badge variant={isAllowed ? "default" : "secondary"}>
                      {isAllowed ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {isAllowed ? "Allow" : "Deny"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Test Runner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              System Tests
            </CardTitle>
            <CardDescription>
              Run comprehensive tests to verify permissions system functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runDatabaseTests}
              disabled={isRunningTests}
              className="w-full"
            >
              {isRunningTests ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Run System Tests
                </>
              )}
            </Button>

            {testResults.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="font-semibold">Test Results</h4>
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{result.test}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.message}
                      </div>
                    </div>
                    <Badge
                      variant={
                        result.status === "pass"
                          ? "default"
                          : result.status === "fail"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {result.status === "pass" && (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {result.status === "fail" && (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {result.status === "loading" && (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {result.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
