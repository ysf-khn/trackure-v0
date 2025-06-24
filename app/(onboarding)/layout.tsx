import React from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      {/* Main Content */}
      <div className="w-full py-12 px-4">{children}</div>
    </div>
  );
}
