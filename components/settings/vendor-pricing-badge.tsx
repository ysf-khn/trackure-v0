import { Badge } from "@/components/ui/badge";
import { DollarSignIcon } from "lucide-react";

interface VendorPricingBadgeProps {
  count: number;
  className?: string;
}

export function VendorPricingBadge({ count, className }: VendorPricingBadgeProps) {
  if (count === 0) return null;

  return (
    <Badge
      variant="secondary"
      className={`text-xs bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 ${className}`}
    >
      <DollarSignIcon className="h-3 w-3 mr-1" />
      {count} vendor{count !== 1 ? 's' : ''}
    </Badge>
  );
}