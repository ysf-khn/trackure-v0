import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GalleryVerticalEnd, Home, PlusCircle } from "lucide-react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

export function SiteHeader() {
  const { organizationName, isLoading } = useProfileAndOrg();

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center justify-between border-b transition-[width,height] ease-linear">
      <div className="flex items-center gap-1 px-2 sm:px-4 lg:gap-2 lg:px-6 min-w-0 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-1 sm:mx-2 data-[orientation=vertical]:h-4"
        />
        <Link href="/settings/organization" className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-base font-medium truncate">
            {isLoading ? "Loading..." : organizationName || "My Organization"}
          </h1>
        </Link>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 lg:px-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="px-2 sm:px-3">
            <Home className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Dashboard</span>
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <Link href="/orders/new">
          <Button variant="ghost" size="sm" className="px-2 sm:px-3">
            <PlusCircle className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">New Order</span>
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="px-2 sm:px-3">
            <GalleryVerticalEnd className="h-4 w-4" />
            <span className="ml-2 hidden lg:inline">All Orders</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
