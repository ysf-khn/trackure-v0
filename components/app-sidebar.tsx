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
import { Badge } from "@/components/ui/badge";
import { useWorkflow } from "@/hooks/queries/use-workflow";
import { useNewItemsCount } from "@/hooks/queries/use-new-items-count";
import { useCompletedItemsCount } from "@/hooks/queries/use-completed-items-count";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

interface SubStage {
  id: string;
  name: string;
  itemCount: number;
}

interface Stage {
  id: string;
  name: string;
  itemCount: number;
  subStages?: SubStage[];
}

const data = {
  navSecondary: [
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

  const {
    data: workflowDataUntyped,
    isLoading: isLoadingWorkflow,
    isError: isErrorWorkflow,
    error: errorWorkflow,
  } = useWorkflow(organizationId || undefined);

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

  const workflowData = workflowDataUntyped as Stage[] | undefined;

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
      const currentSubStageId = searchParams.get("subStage");

      return (
        currentWorkflowPathSegment === "workflow" &&
        currentStageId === stageId &&
        !currentSubStageId
      );
    },
    [pathname, searchParams]
  );

  const isSubStageActive = useCallback(
    (stageId: string, subStageId: string) => {
      const pathSegments = pathname.split("/");
      const currentWorkflowPathSegment = pathSegments[1];
      const currentStageId = pathSegments[2];
      const currentSubStageId = searchParams.get("subStage");

      return (
        currentWorkflowPathSegment === "workflow" &&
        currentStageId === stageId &&
        currentSubStageId === subStageId
      );
    },
    [pathname, searchParams]
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
                    newItemsCount > 0 &&
                      "bg-destructive text-destructive-foreground"
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

        <h3 className="mt-2 mb-1 px-3 text-sm font-semibold tracking-wider">
          Workflow
        </h3>
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
                  Configure Workflow
                </Button>
              </Link>
            </div>
          )}
        {!isLoadingWorkflow &&
          !isErrorWorkflow &&
          workflowData &&
          workflowData.length > 0 && (
            <nav className="flex flex-col space-y-1">
              {workflowData.map((stage: Stage) => {
                const stageName =
                  typeof stage.name === "string" ? stage.name : "Unnamed Stage";
                const active = isActive(stage.id);
                const isOpen = getIsOpen(stage.id);

                return (
                  <Collapsible
                    key={stage.id}
                    open={isOpen}
                    onOpenChange={() => toggleCollapsible(stage.id)}
                    className="w-full group"
                  >
                    <div className="relative flex items-center">
                      <div
                        className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary ${
                          active ? "opacity-100" : "opacity-0"
                        } transition-opacity duration-200`}
                        aria-hidden="true"
                      />
                      {stage.subStages && stage.subStages.length > 0 ? (
                        <CollapsibleTrigger asChild>
                          <Button
                            variant={"ghost"}
                            size="sm"
                            className={cn(
                              "w-full justify-start pl-3 pr-2 flex-grow",
                              active
                                ? "bg-accent/20 text-accent-foreground font-semibold"
                                : "",
                              !isOpen && !active ? "text-muted-foreground" : ""
                            )}
                          >
                            {isOpen ? (
                              <ChevronDown className="mr-2 h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="mr-2 h-4 w-4 flex-shrink-0" />
                            )}
                            <span className="flex-grow text-left mr-2 truncate">
                              {stageName.length > 22
                                ? `${stageName.slice(0, 22)}...`
                                : stageName}
                            </span>
                            <Badge
                              variant={
                                stage.itemCount > 0 ? "default" : "secondary"
                              }
                              className={cn(
                                "flex-shrink-0 mr-1",
                                stage.itemCount > 0 &&
                                  "bg-primary text-primary-foreground"
                              )}
                            >
                              {stage.itemCount}
                            </Badge>
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
                              "w-full justify-start pl-3 pr-2",
                              active
                                ? "bg-accent/20 text-accent-foreground font-semibold"
                                : "",
                              !isOpen && !active ? "text-muted-foreground" : ""
                            )}
                          >
                            <Dot className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="flex-grow text-left mr-2 truncate">
                              {stageName.length > 22
                                ? `${stageName.slice(0, 22)}...`
                                : stageName}
                            </span>
                            <Badge
                              variant={
                                stage.itemCount > 0 ? "default" : "secondary"
                              }
                              className={cn(
                                "flex-shrink-0 mr-1",
                                stage.itemCount > 0 &&
                                  "bg-primary text-primary-foreground"
                              )}
                            >
                              {stage.itemCount}
                            </Badge>
                          </Button>
                        </Link>
                      )}
                    </div>
                    {stage.subStages && stage.subStages.length > 0 && (
                      <CollapsibleContent className="pl-6 pr-2 pt-1 space-y-1 border-l border-border ml-4">
                        {stage.subStages.map((subStage: SubStage) => {
                          const subStageName =
                            typeof subStage.name === "string"
                              ? subStage.name
                              : "Unnamed Sub-stage";
                          const subActive = isSubStageActive(
                            stage.id,
                            subStage.id
                          );

                          return (
                            <div
                              key={subStage.id}
                              className="relative flex items-center w-full"
                            >
                              <div
                                className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary ${
                                  subActive ? "opacity-100" : "opacity-0"
                                } transition-opacity duration-200`}
                                aria-hidden="true"
                              />
                              <Link
                                href={`/workflow/${stage.id}?subStage=${subStage.id}`}
                                passHref
                                className="flex-grow"
                              >
                                <Button
                                  variant={"ghost"}
                                  size="sm"
                                  className={cn(
                                    "w-full justify-start pl-3 pr-2",
                                    subActive
                                      ? "bg-accent/20 text-accent-foreground font-semibold"
                                      : ""
                                  )}
                                >
                                  <span className="flex-grow text-left mr-2 truncate">
                                    {subStageName.length > 22
                                      ? `${subStageName.slice(0, 22)}...`
                                      : subStageName}
                                  </span>
                                  <Badge
                                    variant={
                                      subStage.itemCount > 0
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={cn(
                                      "flex-shrink-0",
                                      subStage.itemCount > 0 &&
                                        "bg-primary text-primary-foreground"
                                    )}
                                  >
                                    {subStage.itemCount}
                                  </Badge>
                                </Button>
                              </Link>
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                );
              })}
            </nav>
          )}

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
