"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  SettingsIcon,
  PackageOpenIcon,
  CheckCircle2Icon,
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
import { useCompletedItemsCount } from "@/hooks/queries/use-completed-items-count";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useSKUs } from "@/hooks/queries/use-skus";
import { useSKUSelection } from "@/contexts/sku-selection-context";
import { useOrderSelection } from "@/contexts/order-selection-context";
import { useOrderSKUs } from "@/hooks/queries/use-order-skus";
import { OrderSelector } from "@/components/workflow-hub/order-selector";


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
  
  // Use order selection context
  const { selectedOrderId } = useOrderSelection();

  // Get available SKUs - either from order or all SKUs
  const { data: allSkuData, isLoading: isLoadingAllSKUs } = useSKUs();
  const { data: orderSkuData, isLoading: isLoadingOrderSKUs } = useOrderSKUs(organizationId, selectedOrderId);
  
  const skuData = selectedOrderId ? orderSkuData : allSkuData;
  const isLoadingSKUs = selectedOrderId ? isLoadingOrderSKUs : isLoadingAllSKUs;


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




  // Available SKUs for the selector
  const availableSKUs = React.useMemo(() => {
    if (selectedOrderId) {
      // Use order-specific SKUs
      if (!orderSkuData) return [];
      return orderSkuData.map((item) => ({
        value: item.sku,
        label: item.sku_name || item.sku,
        completedQuantity: item.completed_quantity,
        totalQuantity: item.total_quantity,
      }));
    } else {
      // Use all SKUs
      if (!allSkuData?.skus) return [];
      return allSkuData.skus.map((item) => ({
        value: item.sku,
        label: item.sku_name || item.sku,
        completedQuantity: 0,
        totalQuantity: 0,
      }));
    }
  }, [selectedOrderId, orderSkuData, allSkuData]);



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

        {/* Order Selection Section */}
        <div className="border-b border-sidebar-border pb-3">
          <OrderSelector />
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
                            {selectedOrderId ? "SKU in Order" : "SKU Workflow"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Select SKU</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedOrderId ? "Select SKU from order" : "Choose SKU workflow"}
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
                            {selectedOrderId && sku.completedQuantity !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                {sku.completedQuantity}/{sku.totalQuantity} completed
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Completed Items Count for Selected SKU */}
          {selectedSKU && (
            <div className="px-3 py-2 border-b border-sidebar-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed Items</span>
                {availableSKUs.find(s => s.value === selectedSKU)?.completedQuantity !== undefined ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {availableSKUs.find(s => s.value === selectedSKU)?.completedQuantity || 0}
                  </Badge>
                ) : (
                  <Skeleton className="h-5 w-12 rounded-full" />
                )}
              </div>
            </div>
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
