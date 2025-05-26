import { ChartBarInteractive } from "@/components/chart-bar-interactive";
import { BottleneckItemsTable } from "@/components/bottleneck-items-table";
import { SectionCards } from "@/components/section-cards";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards />
          <div className="px-4 lg:px-6">
            <ChartBarInteractive />
          </div>
          <div className="px-4 lg:px-6">
            <BottleneckItemsTable limit={10} />
          </div>
        </div>
      </div>
    </div>
  );
}
