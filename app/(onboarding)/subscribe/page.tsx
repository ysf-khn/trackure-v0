"use client";

import React from "react";
import { BillingToggle } from "@/components/landing-page/pricing/billing-toggle";
import { PricingCard } from "@/components/landing-page/pricing/pricing-card";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { Skeleton } from "@/components/ui/skeleton";
import { plans } from "@/lib/plans";
import { FormMessage, Message } from "@/components/form-message";

export default function SubscribePage(props: {
  searchParams: Promise<Message>;
}) {
  const [isAnnual, setIsAnnual] = React.useState(false);
  const { isLoading } = useProfileAndOrg();
  const [searchParams, setSearchParams] = React.useState<Message | null>(null);

  React.useEffect(() => {
    props.searchParams.then(setSearchParams);
  }, [props.searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-12 w-2/3 mx-auto" />
            <Skeleton className="h-6 w-1/2 mx-auto" />
          </div>
          <Skeleton className="h-8 w-48 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Skeleton className="h-[600px] w-full" />
            <Skeleton className="h-[600px] w-full" />
            <Skeleton className="h-[600px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-bold text-white mb-6">
            Choose Your Plan
          </h1>
          <p className="text-gray-300 text-lg">
            Select the plan that best fits your export business needs. All plans
            include our core features and a 14-day free trial to help you get
            started.
          </p>
        </div>

        <BillingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <PricingCard key={plan.title} {...plan} isAnnual={isAnnual} />
          ))}
        </div>

        {searchParams && <FormMessage message={searchParams} />}

        <div className="mt-16 text-center">
          <p className="text-gray-400 text-sm">
            By subscribing, you agree to our Terms of Service and Privacy
            Policy. You can cancel your subscription at any time.
          </p>
        </div>
      </div>
    </main>
  );
}
