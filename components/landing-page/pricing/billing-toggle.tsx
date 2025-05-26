import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface BillingToggleProps {
  isAnnual: boolean;
  onToggle: (value: boolean) => void;
}

export function BillingToggle({ isAnnual, onToggle }: BillingToggleProps) {
  return (
    <div className="flex flex-col items-center gap-4 mb-12">
      <div className="relative p-1 bg-muted rounded-lg">
        <div className="relative z-0 flex">
          <button
            onClick={() => onToggle(false)}
            className={`relative z-10 px-6 py-2 text-sm font-medium transition-colors duration-200 ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => onToggle(true)}
            className={`relative z-10 px-6 py-2 text-sm font-medium transition-colors duration-200 ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Annual
            <span className="absolute -top-3 -right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              16% OFF
            </span>
          </button>
          <div
            className="absolute left-0 top-0 h-full w-1/2 rounded-md bg-background transition-transform duration-200"
            style={{
              transform: `translateX(${isAnnual ? "100%" : "0"})`,
            }}
          />
        </div>
      </div>
      {isAnnual && (
        <p className="text-green-500 font-medium">
          Annual Billing saves you 2 full months – that's 16% OFF your total!
        </p>
      )}
    </div>
  );
}
