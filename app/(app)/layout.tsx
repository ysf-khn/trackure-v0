"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import TrialAlert from "@/components/trial-alert";
import * as React from "react";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<Skeleton className="h-screen w-64" />}>
        <AppSidebar variant="inset" />
      </Suspense>
      <SidebarInset>
        <TrialAlert />
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
