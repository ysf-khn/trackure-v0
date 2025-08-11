"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  SettingsIcon,
  PackageOpenIcon,
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
import { useNewItemsCount } from "@/hooks/queries/use-new-items-count";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useSKUs } from "@/hooks/queries/use-skus";
import { OrderContextSection } from "@/components/sidebar/order-context-section";


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


  const {
    data: newItemsCount,
    isLoading: isLoadingNewItemsCount,
    // isError: isErrorNewItemsCount, // Optional: handle specific error display for count
    // error: errorNewItemsCount
  } = useNewItemsCount(); // Use the new hook







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

        {/* Unified Order Context Section */}
        <OrderContextSection />

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
