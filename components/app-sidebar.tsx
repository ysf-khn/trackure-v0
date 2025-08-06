"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  SettingsIcon,
  Wrench,
  TriangleAlert,
  ChevronDown,
  ChevronRight,
  Dot,
  PackageOpenIcon,
  CheckCircle2Icon,
  Lightbulb,
  Layers,
  BookOpen,
  Package,
  Building2,
  ChevronsUpDown,
  Check,
  BarChart3,
  Users,
  Beaker,
} from "lucide-react";

import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useWorkflowStructure } from "@/hooks/queries/use-workflow-structure";
import { useNewItemsCount } from "@/hooks/queries/use-new-items-count";
import { useCompletedItemsCount } from "@/hooks/queries/use-completed-items-count";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useSKUs } from "@/hooks/queries/use-skus";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import {
  useStageItemCounts,
  calculateTotalStageCount,
  calculateDetailedStageCount,
  calculateWorkflowItemsSummary,
} from "@/hooks/queries/use-stage-item-counts";
import { useWorkflowCostSummary } from "@/hooks/queries/use-workflow-cost-summary";
import { WorkflowCostSummaryComponent } from "@/components/workflow/workflow-cost-summary";
import { WorkflowItemsSummaryComponent } from "@/components/workflow/workflow-items-summary";

// Use the infinite nesting types from useWorkflowStructure
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

const data = {
  navSecondary: [
    {
      title: "Guides",
      url: "/guides",
      icon: BookOpen,
    },
    // {
    //   title: "Feature Requests",
    //   url: "/feature-requests",
    //   icon: Lightbulb,
    // },
    {
      title: "Settings",
      url: "/settings",
      icon: SettingsIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get organization ID for proper query key synchronization
  const { organizationId } = useProfileAndOrg();

  // Use global SKU selection context
  const { selectedSKU, setSelectedSKU } = useSKUSelection();
  const [skuSelectorOpen, setSKUSelectorOpen] = useState(false);

  // Get available SKUs
  const { data: skuData, isLoading: isLoadingSKUs } = useSKUs();

  // Get workflow structure for selected SKU
  const {
    data: workflowData,
    isLoading: isLoadingWorkflow,
    isError: isErrorWorkflow,
    error: errorWorkflow,
  } = useWorkflowStructure(organizationId, selectedSKU);

  const {
    data: newItemsCount,
    isLoading: isLoadingNewItemsCount,
    // isError: isErrorNewItemsCount, // Optional: handle specific error display for count
    // error: errorNewItemsCount
  } = useNewItemsCount(); // Use the new hook

  const {
    data: completedItemsCount,
    isLoading: isLoadingCompletedItemsCount,
    // isError: isErrorCompletedItemsCount, // Optional: handle specific error display for count
    // error: errorCompletedItemsCount
  } = useCompletedItemsCount(); // Use the new hook

  // Get stage item counts for the selected SKU
  const { data: stageCountsData, isLoading: isLoadingStageCounts } =
    useStageItemCounts(organizationId, selectedSKU, workflowData);

  // Debug logging for cost summary hook
  console.log("[AppSidebar] Cost summary hook params:", {
    organizationId,
    selectedSKU,
    workflowData: workflowData?.length || 0,
    hasWorkflowData: !!workflowData
  });

  // Get workflow cost summary for the selected SKU
  const { data: costSummaryData, isLoading: isLoadingCostSummary } =
    useWorkflowCostSummary(organizationId, selectedSKU, workflowData);

  // Calculate workflow items summary
  const workflowItemsSummary = React.useMemo(() => {
    if (!workflowData || !stageCountsData?.stageCountsMap) {
      return {
        totalItems: 0,
        totalQuantity: 0,
        normalQuantity: 0,
        reworkedQuantity: 0,
        stagesWithItems: 0,
        totalStages: 0,
      };
    }
    return calculateWorkflowItemsSummary(workflowData, stageCountsData.stageCountsMap);
  }, [workflowData, stageCountsData]);

  // Available SKUs for the selector
  const availableSKUs = React.useMemo(() => {
    if (!skuData?.skus) return [];
    return skuData.skus.map((item) => ({
      value: item.sku,
      label: item.sku_name || item.sku,
    }));
  }, [skuData]);

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  const toggleCollapsible = useCallback((stageId: string) => {
    setOpenStates((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  }, []);

  const getIsOpen = useCallback(
    (stageId: string) => !!openStates[stageId],
    [openStates]
  );

  const isActive = useCallback(
    (stageId: string) => {
      const pathSegments = pathname.split("/");
      const currentWorkflowPathSegment = pathSegments[1];
      const currentStageId = pathSegments[2];

      return (
        currentWorkflowPathSegment === "workflow" && currentStageId === stageId
      );
    },
    [pathname]
  );

  // Get depth indicator color based on nesting level
  const getDepthIndicatorColor = useCallback((depth: number) => {
    const colors = [
      "bg-blue-500", // Level 0
      "bg-green-500", // Level 1
      "bg-orange-500", // Level 2
      "bg-purple-500", // Level 3
      "bg-pink-500", // Level 4+
    ];
    return colors[Math.min(depth, colors.length - 1)];
  }, []);

  // Recursive component for rendering workflow stages with infinite nesting
  const renderWorkflowStage = useCallback(
    (stage: FetchedWorkflowStage, depth: number = 0) => {
      const stageName = stage.name || "Unnamed Stage";
      const active = isActive(stage.id);
      const isOpen = getIsOpen(stage.id);
      const hasSubStages = stage.children && stage.children.length > 0;
      const indentPadding = depth * 8; // Minimal 8px per level instead of 16px
      const depthIndicatorColor = getDepthIndicatorColor(depth);
      const textOpacity = Math.max(0.7, 1 - depth * 0.1); // Slightly fade deeper levels

      // Calculate detailed item counts for this stage (normal + reworked)
      const detailedCount = stageCountsData?.stageCountsMap
        ? calculateDetailedStageCount(
            stage.id,
            workflowData,
            stageCountsData.stageCountsMap
          )
        : { totalQuantity: 0, normalQuantity: 0, reworkedQuantity: 0 };
      
      const itemCount = detailedCount.totalQuantity;
      const hasReworked = detailedCount.reworkedQuantity > 0;

      return (
        <Collapsible
          key={stage.id}
          open={isOpen}
          onOpenChange={() => toggleCollapsible(stage.id)}
          className="w-full group"
        >
          <div
            className="relative flex items-center"
            style={{ paddingLeft: `${indentPadding}px` }}
          >
            {/* Active state indicator */}
            <div
              className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary ${
                active ? "opacity-100" : "opacity-0"
              } transition-opacity duration-200`}
              aria-hidden="true"
            />

            {/* Depth indicator - only show for nested levels */}
            {depth > 0 && (
              <div
                className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${depthIndicatorColor}`}
                style={{ marginLeft: `${Math.max(0, indentPadding - 16)}px` }}
                aria-hidden="true"
              />
            )}

            {/* Connecting line for nested items */}
            {depth > 0 && (
              <div
                className="absolute w-px bg-border opacity-40"
                style={{
                  left: `${indentPadding - 12}px`,
                  top: "-8px",
                  height: "20px",
                }}
                aria-hidden="true"
              />
            )}

            {hasSubStages ? (
              <CollapsibleTrigger asChild>
                <Button
                  variant={"ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start pr-2 flex-grow",
                    depth === 0 ? "pl-3" : "pl-1",
                    active
                      ? "bg-accent/20 text-accent-foreground font-semibold"
                      : "",
                    !isOpen && !active ? "text-muted-foreground" : ""
                  )}
                  style={{ opacity: textOpacity }}
                >
                  {isOpen ? (
                    <ChevronDown className="mr-2 h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="flex-grow text-left mr-2 truncate">
                    {stageName.length > (depth > 0 ? 18 : 22)
                      ? `${stageName.slice(0, depth > 0 ? 18 : 22)}...`
                      : stageName}
                  </span>
                  {isLoadingStageCounts ? (
                    <Skeleton className="h-4 w-6 rounded-full flex-shrink-0 mr-1" />
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0 mr-1">
                      {hasReworked ? (
                        <>
                          <Badge
                            variant="default"
                            className="bg-primary text-white text-xs px-1.5 py-0.5"
                          >
                            {detailedCount.normalQuantity}
                          </Badge>
                          <span className="text-muted-foreground text-xs">|</span>
                          <Badge
                            variant="destructive"
                            className="bg-orange-500 text-white text-xs px-1.5 py-0.5"
                          >
                            {detailedCount.reworkedQuantity}
                          </Badge>
                        </>
                      ) : (
                        <Badge
                          variant={itemCount > 0 ? "default" : "secondary"}
                          className="bg-primary text-white"
                        >
                          {itemCount}
                        </Badge>
                      )}
                    </div>
                  )}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <Link
                href={`/workflow/${stage.id}`}
                passHref
                className="flex-grow"
              >
                <Button
                  variant={"ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start pr-2",
                    depth === 0 ? "pl-3" : "pl-1",
                    active
                      ? "bg-accent/20 text-accent-foreground font-semibold"
                      : "",
                    !isOpen && !active ? "text-muted-foreground" : ""
                  )}
                  style={{ opacity: textOpacity }}
                >
                  <Dot className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-grow text-left mr-2 truncate">
                    {stageName.length > (depth > 0 ? 18 : 22)
                      ? `${stageName.slice(0, depth > 0 ? 18 : 22)}...`
                      : stageName}
                  </span>
                  {isLoadingStageCounts ? (
                    <Skeleton className="h-4 w-6 rounded-full flex-shrink-0 mr-1" />
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0 mr-1">
                      {hasReworked ? (
                        <>
                          <Badge
                            variant="default"
                            className="bg-primary text-white text-xs px-1.5 py-0.5"
                          >
                            {detailedCount.normalQuantity}
                          </Badge>
                          <span className="text-muted-foreground text-xs">|</span>
                          <Badge
                            variant="destructive"
                            className="bg-orange-500 text-white text-xs px-1.5 py-0.5"
                          >
                            {detailedCount.reworkedQuantity}
                          </Badge>
                        </>
                      ) : (
                        <Badge
                          variant={itemCount > 0 ? "default" : "secondary"}
                          className="bg-primary text-white"
                        >
                          {itemCount}
                        </Badge>
                      )}
                    </div>
                  )}
                </Button>
              </Link>
            )}
          </div>
          {hasSubStages && (
            <CollapsibleContent className="pt-1 space-y-1">
              {stage?.children?.map((childStage) =>
                renderWorkflowStage(childStage, depth + 1)
              )}
            </CollapsibleContent>
          )}
        </Collapsible>
      );
    },
    [
      isActive,
      getIsOpen,
      toggleCollapsible,
      getDepthIndicatorColor,
      stageCountsData,
      workflowData,
      isLoadingStageCounts,
    ]
  );

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <Image
                  src="/logo-grey-bg.svg"
                  alt="Trakure Logo"
                  width={20}
                  height={20}
                />
                <span className="text-xl font-semibold">Trakure</span>
                {process.env.NEXT_PUBLIC_ENV === "preview" && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                  >
                    PREVIEW
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} /> */}

        <div className="px-3 py-3 border-b border-sidebar-border">
          <Link href="/new-orders" passHref>
            <Button
              variant={pathname === "/new-orders" ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start pl-3 pr-2"
            >
              <PackageOpenIcon className="mr-2 h-4 w-4" />
              <span className="flex-grow text-left mr-2 truncate">
                New Order Items
              </span>
              {!isLoadingNewItemsCount && typeof newItemsCount === "number" && (
                <Badge
                  variant={newItemsCount > 0 ? "default" : "secondary"}
                  className={cn(
                    "flex-shrink-0",
                    newItemsCount > 0 && "bg-primary text-white"
                  )}
                >
                  {newItemsCount}
                </Badge>
              )}
              {isLoadingNewItemsCount && (
                <Skeleton className="h-4 w-6 rounded-full" />
              )}
            </Button>
          </Link>
        </div>

        {/* SKU Workflow Section */}
        <div className="space-y-2">
          <h3 className="mt-2 mb-1 px-3 text-sm font-semibold tracking-wider">
            SKU Workflow
          </h3>

          {/* SKU Selector */}
          <div className="px-3">
            <Popover open={skuSelectorOpen} onOpenChange={setSKUSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={skuSelectorOpen}
                  className="w-full justify-between text-left h-auto py-2"
                  disabled={isLoadingSKUs}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedSKU ? (
                      <>
                        <Package className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">
                            {availableSKUs.find(
                              (sku) => sku.value === selectedSKU
                            )?.label || selectedSKU}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            SKU Workflow
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Select SKU</div>
                          <div className="text-xs text-muted-foreground">
                            Choose SKU workflow
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search SKUs..." />
                  <CommandList>
                    <CommandEmpty>No SKUs found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setSelectedSKU(null);
                          setSKUSelectorOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSKU === null ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Building2 className="mr-2 h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium">None</div>
                          <div className="text-xs text-muted-foreground">
                            No SKU selected
                          </div>
                        </div>
                      </CommandItem>
                      {availableSKUs.map((sku) => (
                        <CommandItem
                          key={sku.value}
                          value={sku.value}
                          onSelect={(currentValue) => {
                            setSelectedSKU(
                              currentValue === selectedSKU ? null : currentValue
                            );
                            setSKUSelectorOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSKU === sku.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <Package className="mr-2 h-4 w-4" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {sku.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {sku.value}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Items Summary - Only show when SKU is selected */}
          {selectedSKU && (
            <WorkflowItemsSummaryComponent 
              itemsSummary={workflowItemsSummary}
              isLoading={isLoadingStageCounts}
            />
          )}

          {/* Cost Summary - Only show when SKU is selected */}
          {selectedSKU && (
            <WorkflowCostSummaryComponent 
              costSummary={costSummaryData}
              isLoading={isLoadingCostSummary}
            />
          )}

          {/* Workflow Stages */}
          {isLoadingWorkflow && (
            <div className="space-y-2 px-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {isErrorWorkflow && (
            <Alert variant="destructive" className="mx-3">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>
                Error loading workflow:{" "}
                {errorWorkflow?.message || "Unknown error"}
              </AlertDescription>
            </Alert>
          )}
          {!isLoadingWorkflow &&
            !isErrorWorkflow &&
            (!workflowData || workflowData.length === 0) && (
              <div className="px-3">
                <Link href="/settings" passHref>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    {selectedSKU
                      ? "Configure SKU Workflow"
                      : "Configure Workflow"}
                  </Button>
                </Link>
              </div>
            )}
          {!isLoadingWorkflow &&
            !isErrorWorkflow &&
            workflowData &&
            workflowData.length > 0 && (
              <nav className="flex flex-col space-y-1 px-3">
                {workflowData.map((stage) => renderWorkflowStage(stage))}
              </nav>
            )}
        </div>

        {/* Completed Items Section */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <Link href="/completed-items" passHref>
            <Button
              variant={pathname === "/completed-items" ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start pl-3 pr-2"
            >
              <CheckCircle2Icon className="mr-2 h-4 w-4" />
              <span className="flex-grow text-left mr-2 truncate">
                Completed Items
              </span>
              {!isLoadingCompletedItemsCount &&
                typeof completedItemsCount === "number" && (
                  <Badge
                    variant={completedItemsCount > 0 ? "default" : "secondary"}
                    className={cn(
                      "flex-shrink-0",
                      completedItemsCount > 0 && "bg-green-600 text-white"
                    )}
                  >
                    {completedItemsCount}
                  </Badge>
                )}
              {isLoadingCompletedItemsCount && (
                <Skeleton className="h-4 w-6 rounded-full" />
              )}
            </Button>
          </Link>
        </div>

        {/* Management Modules Section */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
          <h3 className="mb-2 text-sm font-semibold tracking-wider text-muted-foreground">
            Management
          </h3>

          <Link href="/sku-management" passHref>
            <Button
              variant={pathname === "/sku-management" ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start pl-3"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              <span className="flex-grow text-left truncate">
                SKU Management
              </span>
            </Button>
          </Link>

          <Link href="/vendors" passHref>
            <Button
              variant={pathname === "/vendors" ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start pl-3"
            >
              <Users className="mr-2 h-4 w-4" />
              <span className="flex-grow text-left truncate">Vendors</span>
            </Button>
          </Link>

          <Link href="/samples" passHref>
            <Button
              variant={pathname === "/samples" ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start pl-3"
            >
              <Beaker className="mr-2 h-4 w-4" />
              <span className="flex-grow text-left truncate">Samples</span>
            </Button>
          </Link>
        </div>

        <NavSecondary
          items={data.navSecondary}
          className="mt-auto border-t border-sidebar-border"
        />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
