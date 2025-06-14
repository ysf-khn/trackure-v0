import React from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { selectPlanAction } from "@/app/actions";

interface PricingFeature {
  text: string;
}

interface PricingCardProps {
  title: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyProductId: string;
  annualProductId: string;
  description: string;
  isPopular?: boolean;
  keyFeatures: PricingFeature[];
  isAnnual: boolean;
}

export function PricingCard({
  title,
  monthlyPrice,
  annualPrice,
  monthlyProductId,
  annualProductId,
  description,
  isPopular,
  keyFeatures,
  isAnnual,
}: PricingCardProps) {
  const pathname = usePathname();
  const isSubscribePage = pathname === "/subscribe";

  const displayPrice = isAnnual ? annualPrice : monthlyPrice;
  const productId = isAnnual ? annualProductId : monthlyProductId;
  const annualSavings = ((monthlyPrice - annualPrice) * 12).toLocaleString(
    "en-IN"
  );

  return (
    <div
      className={`relative rounded-xl p-8 ${
        isPopular ? "bg-blue-900/20 border-2 border-blue-500" : "bg-gray-900/50"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
          Most Popular
        </div>
      )}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <div className="mb-4">
          <span className="text-4xl font-bold text-white">
            ₹{displayPrice.toLocaleString("en-IN")}
          </span>
          <span className="text-gray-400">/month</span>
          {isAnnual && (
            <div className="text-sm text-gray-400 mt-2">
              billed annually at ₹{(displayPrice * 12).toLocaleString("en-IN")}
              <div className="text-green-500">Save ₹{annualSavings}/year</div>
            </div>
          )}
        </div>
        <p className="text-gray-300">{description}</p>
      </div>

      {isSubscribePage ? (
        <form action={selectPlanAction} className="mb-8">
          <input type="hidden" name="productId" value={productId} />
          <Button
            type="submit"
            className="w-full"
            variant={isPopular ? "default" : "outline"}
          >
            Select Plan
          </Button>
        </form>
      ) : (
        <Link href={`/sign-up?productId=${productId}`} className="block mb-8">
          <Button
            className="w-full"
            variant={isPopular ? "default" : "outline"}
          >
            Start 14-Day Free Trial
          </Button>
        </Link>
      )}

      <div className="space-y-4">
        <div className="font-medium text-white mb-4">Key Features:</div>
        {keyFeatures.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-500 mt-0.5" />
            <span className="text-gray-300">{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
