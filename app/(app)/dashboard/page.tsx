import { SectionCards } from "@/components/section-cards";
import { PlanLimitsAlert } from "@/components/plan-limits-alert";
import { DashboardClient } from "@/components/dashboard-client";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Plan limits alert - shows when approaching or exceeding limits */}
          <PlanLimitsAlert />

          {/* Core stats - keep these server-side rendered */}
          <SectionCards />

          {/* Client-side components - dynamically loaded */}
          <DashboardClient />
        </div>
      </div>
    </div>
  );
}
