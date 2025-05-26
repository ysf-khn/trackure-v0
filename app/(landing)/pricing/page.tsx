"use client";

import React from "react";
import { Navbar } from "@/components/landing-page/navbar";
import { Footer } from "@/components/landing-page/footer";
import { PricingHeader } from "@/components/landing-page/pricing/pricing-header";
import { BillingToggle } from "@/components/landing-page/pricing/billing-toggle";
import { PricingCard } from "@/components/landing-page/pricing/pricing-card";
import { FAQSection } from "@/components/landing-page/pricing/faq-section";
import { PricingCTA } from "@/components/landing-page/pricing/pricing-cta";
import { PricingComparison } from "@/components/landing-page/pricing/pricing-comparison";
import { plans } from "@/lib/plans";

const featureComparison = {
  categories: [
    {
      name: "Core Features",
      features: [
        {
          name: "Full Workflow Tracking & Customization",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "Rework Recording & Management",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "Remarks & Item History",
          essentials: true,
          professional: true,
          business: true,
        },
      ],
    },
    {
      name: "Packaging & Documentation",
      features: [
        {
          name: "Packaging Material Planning",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "Packaging Reminders (Email & In-App)",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "PDF Voucher & Invoice Generation",
          essentials: true,
          professional: true,
          business: true,
        },
      ],
    },
    {
      name: "Data Management",
      features: [
        {
          name: "Payment Status Recording",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "Image Uploads & Viewing",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "CSV Data Export",
          essentials: true,
          professional: true,
          business: true,
        },
        {
          name: "Implicit Item Master",
          essentials: true,
          professional: true,
          business: true,
        },
      ],
    },
    {
      name: "Future Features",
      features: [
        {
          name: "Access to New Features",
          essentials: false,
          professional: true,
          business: true,
        },
        {
          name: "Priority Feature Requests",
          essentials: false,
          professional: true,
          business: true,
        },
        {
          name: "Beta Program Access",
          essentials: false,
          professional: true,
          business: true,
        },
      ],
    },
  ],
};

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = React.useState(false);

  return (
    <main className="relative min-h-screen flex flex-col bg-black">
      <Navbar />
      <div className="flex-1 pt-16">
        <PricingHeader />
        <div className="max-w-7xl mx-auto px-4">
          <BillingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan, index) => (
              <PricingCard key={index} {...plan} isAnnual={isAnnual} />
            ))}
          </div>
          <PricingComparison comparison={featureComparison} plans={plans} />
        </div>
        <FAQSection />
        <PricingCTA />
      </div>
      <Footer />
    </main>
  );
}
