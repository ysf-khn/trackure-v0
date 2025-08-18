"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DatePeriod } from "@/hooks/queries/use-vendor-payment-summary";

interface VendorSummaryFiltersProps {
  period: DatePeriod;
  onPeriodChange: (period: DatePeriod) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
}

export function VendorSummaryFilters({
  period,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
}: VendorSummaryFiltersProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handlePeriodChange = (value: DatePeriod) => {
    onPeriodChange(value);
    if (value !== "custom") {
      onDateRangeChange?.(undefined);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    onDateRangeChange?.(range);
    if (range?.from && range?.to) {
      setIsCalendarOpen(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "last_7_days":
        return "Last 7 days";
      case "last_30_days":
        return "Last 30 days";
      case "last_90_days":
        return "Last 90 days";
      case "this_month":
        return "This month";
      case "last_month":
        return "Last month";
      case "custom":
        if (dateRange?.from && dateRange?.to) {
          return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
        }
        return "Custom range";
      default:
        return "Select period";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last_7_days">Last 7 days</SelectItem>
          <SelectItem value="last_30_days">Last 30 days</SelectItem>
          <SelectItem value="last_90_days">Last 90 days</SelectItem>
          <SelectItem value="this_month">This month</SelectItem>
          <SelectItem value="last_month">Last month</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {period === "custom" && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}

      <div className="text-sm text-muted-foreground">
        Showing data for: <span className="font-medium">{getPeriodLabel()}</span>
      </div>
    </div>
  );
}