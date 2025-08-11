"use client";

import { useState } from "react";
import { 
  Package, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Workflow,
  Calendar,
  Tag,
  Edit,
  ExternalLink,
  History,
  Calculator,
  Plus,
  Clock,
  CheckCircle,
  Circle,
  Star,
  Save
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateTemplateModal } from "./create-template-modal";

interface SKUDetailsModalProps {
  sku: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SKUDetailsModal({
  sku,
  open,
  onOpenChange,
}: SKUDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "workflow" | "vendors" | "samples" | "costs">("overview");
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);

  const { data: skuDetails, isLoading, error } = useQuery({
    queryKey: ["sku-details", sku],
    queryFn: async () => {
      const response = await fetch(`/api/sku-management/${sku}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch SKU details");
      }
      return response.json();
    },
    enabled: open && !!sku,
  });

  const { data: templateData, isLoading: templateLoading } = useQuery({
    queryKey: ["sku-templates", sku],
    queryFn: async () => {
      const response = await fetch(`/api/sku-management/${sku}/templates`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch template data");
      }
      return response.json();
    },
    enabled: open && !!sku && activeTab === "workflow",
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load SKU details: {error.message}
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  const skuData = skuDetails?.sku;
  if (!skuData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Package className="h-5 w-5" />
                {skuData.sku}
              </DialogTitle>
              <DialogDescription>
                {skuData.sku_name || "SKU Details"}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit SKU
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Workflow
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("overview")}
            className="flex-1"
          >
            Overview
          </Button>
          <Button
            variant={activeTab === "workflow" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("workflow")}
            className="flex-1"
          >
            <Workflow className="h-4 w-4 mr-2" />
            Workflow ({skuData.workflow_stages_count || 0})
          </Button>
          <Button
            variant={activeTab === "vendors" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("vendors")}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            Vendors ({skuData.vendors_count || 0})
          </Button>
          <Button
            variant={activeTab === "samples" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("samples")}
            className="flex-1"
          >
            <Package className="h-4 w-4 mr-2" />
            Samples ({skuData.samples_count || 0})
          </Button>
          <Button
            variant={activeTab === "costs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("costs")}
            className="flex-1"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Costs
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Items</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{skuData.active_items_count || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    In workflow
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{skuData.completed_items_count || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Total completed
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {skuData.final_calculated_cost ? `₹${Math.round(skuData.final_calculated_cost)}` : "Not calculated"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per unit cost
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {skuData.last_movement ? new Date(skuData.last_movement).toLocaleDateString() : "No activity"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last movement
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* SKU Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SKU Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">SKU Code</p>
                    <p className="text-sm text-muted-foreground font-mono">{skuData.sku}</p>
                  </div>
                  {skuData.sku_name && (
                    <div>
                      <p className="text-sm font-medium mb-1">SKU Name</p>
                      <p className="text-sm text-muted-foreground">{skuData.sku_name}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium">Workflow Stages</p>
                    <p className="text-sm text-muted-foreground">
                      {skuData.workflow_stages_count || 0} stages configured
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Available Vendors</p>
                    <p className="text-sm text-muted-foreground">
                      {skuData.vendors_count || 0} vendors with pricing
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "workflow" && (
          <div className="space-y-6">
            {templateLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : templateData?.templates?.length > 0 ? (
              <div className="space-y-6">
                {/* Current Active Template */}
                {templateData.template_usage_stats.active_template && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          Active Template
                        </CardTitle>
                        <Badge variant="default" className="bg-green-500 text-white">
                          Current
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="font-medium">{templateData.template_usage_stats.active_template.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {templateData.template_usage_stats.active_template.description || "No description"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Performance</p>
                          <p className="text-sm text-muted-foreground">
                            {templateData.template_usage_stats.active_template.completed_count} completions
                          </p>
                          {templateData.template_usage_stats.active_template.avg_completion_days && (
                            <p className="text-sm text-muted-foreground">
                              Avg: {Math.round(templateData.template_usage_stats.active_template.avg_completion_days)} days
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">Stages</p>
                          <p className="text-sm text-muted-foreground">
                            {templateData.template_usage_stats.active_template.stages?.length || 0} workflow stages
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Template History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Template History
                    </CardTitle>
                    <CardDescription>
                      All workflow templates created for this SKU
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {templateData.templates.map((template: any) => (
                        <div
                          key={template.id}
                          className={`border rounded-lg p-4 ${template.is_active ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {template.is_active ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-gray-400" />
                              )}
                              <div>
                                <h4 className="font-medium">{template.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Created {new Date(template.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="text-center">
                                <p className="font-medium">{template.completed_count}</p>
                                <p>Uses</p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium">{template.stages?.length || 0}</p>
                                <p>Stages</p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium">{template.performance_score}%</p>
                                <p>Score</p>
                              </div>
                              {template.avg_completion_days && (
                                <div className="text-center">
                                  <p className="font-medium">{Math.round(template.avg_completion_days)}</p>
                                  <p>Days</p>
                                </div>
                              )}
                            </div>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Current Workflow Stages */}
                {templateData.current_workflow.stages.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Workflow className="h-5 w-5" />
                          Current Workflow Stages
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCreateTemplateModalOpen(true)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save as Template
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {templateData.current_workflow.stages.map((stage: any) => (
                          <div
                            key={stage.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                stage.is_leaf_stage ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {stage.sequence_order}
                              </div>
                              <div>
                                <p className="font-medium">{stage.name}</p>
                                {stage.location && (
                                  <p className="text-sm text-muted-foreground">{stage.location}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {stage.is_leaf_stage && (
                                <Badge variant="outline">Leaf Stage</Badge>
                              )}
                              <Badge variant="secondary">
                                Level {stage.depth_level}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Vendor Pricing Summary */}
                {templateData.current_workflow.vendor_pricing.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Configured Vendors ({templateData.current_workflow.vendor_pricing.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {templateData.current_workflow.vendor_pricing.map((pricing: any) => (
                          <div
                            key={pricing.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{pricing.vendors.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {pricing.workflow_stages.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                ₹{pricing.price} {pricing.currency || 'INR'}
                              </p>
                              {pricing.lead_time_days && (
                                <p className="text-sm text-muted-foreground">
                                  {pricing.lead_time_days} days lead time
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              // Check if there's a current workflow even without templates
              templateData?.current_workflow?.stages?.length > 0 ? (
                <div className="space-y-6">
                  {/* Show current workflow and save option */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Workflow className="h-5 w-5" />
                          Current Workflow ({templateData.current_workflow.stages.length} stages)
                        </CardTitle>
                        <Button
                          variant="default"
                          onClick={() => setIsCreateTemplateModalOpen(true)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save as Template
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        You have a configured workflow but no saved templates. Save your current workflow as a template for future use.
                      </p>
                      <div className="space-y-2">
                        {templateData.current_workflow.stages.map((stage: any) => (
                          <div
                            key={stage.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                stage.is_leaf_stage ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {stage.sequence_order}
                              </div>
                              <div>
                                <p className="font-medium">{stage.name}</p>
                                {stage.location && (
                                  <p className="text-sm text-muted-foreground">{stage.location}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {stage.is_leaf_stage && (
                                <Badge variant="outline">Leaf Stage</Badge>
                              )}
                              <Badge variant="secondary">
                                Level {stage.depth_level}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Workflow className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No workflow configured</h3>
                    <p className="text-muted-foreground mb-4">
                      Configure a workflow for this SKU to manage production stages and vendor assignments.
                    </p>
                    <Link href={`/settings?tab=workflow&sku=${encodeURIComponent(sku)}`}>
                      <Button>
                        <Edit className="h-4 w-4 mr-2" />
                        Configure Workflow
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}

        {activeTab === "vendors" && (
          <div className="space-y-4">
            <Card className="text-center py-12">
              <CardContent>
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Vendor pricing</h3>
                <p className="text-muted-foreground mb-4">
                  Vendor pricing for this SKU will be displayed here.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor Pricing
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "samples" && (
          <div className="space-y-4">
            <Card className="text-center py-12">
              <CardContent>
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Associated samples</h3>
                <p className="text-muted-foreground mb-4">
                  Samples associated with this SKU will be displayed here.
                </p>
                <Button>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Samples
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "costs" && (
          <div className="space-y-4">
            <Card className="text-center py-12">
              <CardContent>
                <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Cost breakdown</h3>
                <p className="text-muted-foreground mb-4">
                  Detailed cost calculations and history will be displayed here.
                </p>
                <Button>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Costs
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>

      {/* Create Template Modal */}
      <CreateTemplateModal
        sku={sku}
        open={isCreateTemplateModalOpen}
        onOpenChange={setIsCreateTemplateModalOpen}
      />
    </Dialog>
  );
}