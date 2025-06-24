"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/components/hooks/use-mobile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMovementStats } from "@/hooks/queries/use-movement-stats";

const chartConfig = {
  movements: {
    label: "Item Movements",
    color: "transparent",
  },
  forward: {
    label: "Forward Movements",
    color: "hsl(var(--primary))", // Primary blue color
  },
  rework: {
    label: "Rework Movements",
    color: "hsl(var(--primary) / 0.6)", // Toned down primary color
  },
} satisfies ChartConfig;

export function ChartBarInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>("forward");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  // Convert timeRange to days
  const days = React.useMemo(() => {
    switch (timeRange) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      default:
        return 30;
    }
  }, [timeRange]);

  const { data: movementData, isLoading, error } = useMovementStats(days);

  const filteredData = React.useMemo(() => {
    if (!movementData) return [];

    // Filter data based on time range
    const referenceDate = new Date();
    let daysToSubtract = days;
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return movementData.filter((item) => {
      const date = new Date(item.date);
      return date >= startDate;
    });
  }, [movementData, days]);

  const total = React.useMemo(() => {
    if (!filteredData) return { forward: 0, rework: 0 };

    return {
      forward: filteredData.reduce((acc, curr) => acc + curr.forward, 0),
      rework: filteredData.reduce((acc, curr) => acc + curr.rework, 0),
    };
  }, [filteredData]);

  if (error) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Movement Statistics</CardTitle>
          <CardDescription>Error loading movement data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load movement statistics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Movement Statistics</CardTitle>
          <CardDescription>
            <span className="@[540px]/card:block hidden">
              Showing item movements for the selected period
            </span>
            <span className="@[540px]/card:hidden">Item movements</span>
          </CardDescription>
          <div className="@[767px]/card:hidden flex">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40" aria-label="Select a value">
                <SelectValue placeholder="Last 30 days" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">
                  Last 3 months
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="@[767px]/card:flex hidden">
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
            >
              <ToggleGroupItem value="90d" className="h-8 px-2.5">
                Last 3 months
              </ToggleGroupItem>
              <ToggleGroupItem value="30d" className="h-8 px-2.5">
                Last 30 days
              </ToggleGroupItem>
              <ToggleGroupItem value="7d" className="h-8 px-2.5">
                Last 7 days
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="flex">
          {(["forward", "rework"] as const).map((key) => {
            const chart = key as keyof typeof chartConfig;
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/15 sm:border-l sm:border-t-0 sm:px-8 sm:py-6 transition-all duration-200 hover:bg-muted/10 data-[active=true]:shadow-sm"
                onClick={() => setActiveChart(chart)}
                style={{
                  borderLeftColor:
                    activeChart === chart
                      ? chart === "forward"
                        ? "oklch(0.623 0.214 259.815)"
                        : "oklch(0.623 0.214 259.815 / 0.6)"
                      : undefined,
                  borderLeftWidth: activeChart === chart ? "3px" : undefined,
                  backgroundColor:
                    activeChart === chart ? "var(--muted)" : undefined,
                }}
              >
                <span className="text-xs text-muted-foreground">
                  {chartConfig[chart].label}
                </span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {isLoading
                    ? "..."
                    : total[key as keyof typeof total].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={filteredData}
            margin={{
              left: 16,
              right: 16,
              top: 8,
              bottom: 8,
            }}
          >
            <defs>
              <linearGradient id="forwardGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="oklch(0.623 0.214 259.815)"
                  stopOpacity={0.9}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(0.623 0.214 259.815)"
                  stopOpacity={0.6}
                />
              </linearGradient>
              <linearGradient id="reworkGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="oklch(0.623 0.214 259.815)"
                  stopOpacity={0.5}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(0.623 0.214 259.815)"
                  stopOpacity={0.3}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={32}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[180px] rounded-lg border shadow-lg"
                  nameKey="movements"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey={activeChart}
              fill={
                activeChart === "forward"
                  ? "url(#forwardGradient)"
                  : "url(#reworkGradient)"
              }
              radius={[6, 6, 0, 0]}
              strokeWidth={0}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
