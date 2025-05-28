"use client";

import {
  BellIcon,
  BuildingIcon,
  CreditCardIcon,
  ExternalLink,
  LightbulbIcon,
  LogOutIcon,
  MoreVerticalIcon,
  UserCircleIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOutAction } from "@/app/actions";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import Link from "next/link";

export function NavUser() {
  const { user, profile, isLoading, error } = useProfileAndOrg();
  const { isMobile } = useSidebar();

  // Use the avatar URL hook for proper caching
  const { avatarUrl } = useAvatarUrl({
    rawAvatarUrl: user?.user_metadata?.avatar_url,
    userId: user?.id,
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage
                  src={avatarUrl || undefined}
                  alt={user?.user_metadata?.name}
                  key={avatarUrl} // Force re-render when URL changes
                />
                <AvatarFallback className="rounded-lg">
                  {profile?.full_name
                    ? profile.full_name
                        .split(" ")
                        .map((name) => name[0])
                        .join("")
                        .toUpperCase()
                        .substring(0, 2)
                    : "--"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {profile?.full_name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={avatarUrl || undefined}
                    alt={user?.user_metadata?.name}
                    key={avatarUrl} // Force re-render when URL changes
                  />
                  <AvatarFallback className="rounded-lg">
                    {profile?.full_name
                      ? profile.full_name
                          .split(" ")
                          .map((name) => name[0])
                          .join("")
                          .toUpperCase()
                          .substring(0, 2)
                      : "--"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {profile?.full_name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings/account">
                  <UserCircleIcon className="h-4 w-4 mr-2" />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/organization">
                  <BuildingIcon className="h-4 w-4 mr-2" />
                  Organization
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing">
                  <CreditCardIcon className="mr-2 h-4 w-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="https://trakure.featurebase.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LightbulbIcon className="mr-2 h-4 w-4" />
                  Feature Request
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => await signOutAction()}>
              <LogOutIcon className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
