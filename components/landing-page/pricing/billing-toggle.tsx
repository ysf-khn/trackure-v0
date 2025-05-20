import { Switch } from "@/components/ui/switch";

interface BillingToggleProps {
  isAnnual: boolean;
  onToggle: (value: boolean) => void;
}

export function BillingToggle({ isAnnual, onToggle }: BillingToggleProps) {
  return (
    <div className="flex flex-col items-center gap-4 mb-12">
      <div className="flex items-center gap-4">
        <span
          className={`text-lg ${!isAnnual ? "text-white" : "text-gray-400"}`}
        >
          Monthly
        </span>
        <Switch
          checked={isAnnual}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-blue-600"
        />
        <span
          className={`text-lg ${isAnnual ? "text-white" : "text-gray-400"}`}
        >
          Annual
        </span>
      </div>
      {isAnnual && (
        <p className="text-green-500 font-medium">
          Annual Billing Gets You 16% OFF!
        </p>
      )}
    </div>
  );
}
