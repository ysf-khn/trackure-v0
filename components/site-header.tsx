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
      <div className="flex items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Link href="/organization">
          <h1 className="text-base font-medium">
            {isLoading ? "Loading..." : organizationName || "My Organization"}
          </h1>
        </Link>
      </div>
      <div className="flex items-center gap-2 px-4 lg:px-6">
        <Link href="/dashboard">
          <Button variant="ghost">
            <Home className="mr-2 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="/orders/new">
          <Button variant="ghost">
            <PlusCircle className="mr-2 h-4 w-4" /> New Order
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="/orders">
          <Button variant="ghost">
            <GalleryVerticalEnd className="mr-2 h-4 w-4" /> All Orders
          </Button>
        </Link>
      </div>
    </header>
  );
}
