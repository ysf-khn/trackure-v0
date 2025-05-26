import React from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <div className="w-full">
        {/* Optional: Add a logo or onboarding progress indicator here */}
        {children}
      </div>
    </div>
  );
}
