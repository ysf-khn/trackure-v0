import React from "react";
import { Button } from "@/components/ui/button";

export function PricingCTA() {
  return (
    <div className="text-center max-w-3xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-white mb-6">
        Ready to simplify your export workflow?
      </h2>
      <p className="text-gray-300 text-lg mb-8">
        Pick your plan and start your free 14-day trial today.
      </p>
      <Button size="lg" className="px-8">
        Start My Free Trial
      </Button>
    </div>
  );
}
