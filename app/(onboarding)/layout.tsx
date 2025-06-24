import React from "react";
import { Check } from "lucide-react";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

function OnboardingProgress({
  currentStep,
  totalSteps,
  stepTitles,
}: OnboardingProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      {/* Progress Bar */}
      <div className="flex items-center justify-center mb-4 px-4">
        {stepTitles.map((title, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={stepNumber} className="flex items-center">
              <div className="flex flex-col items-center">
                {/* Step Circle */}
                <div
                  className={`
                  flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium
                  ${
                    isCompleted
                      ? "bg-green-600 text-white"
                      : isCurrent
                        ? "bg-primary text-white"
                        : "bg-gray-700 text-gray-400"
                  }
                `}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
                </div>

                {/* Step Title */}
                <p
                  className={`text-xs font-medium mt-2 text-center max-w-[80px] ${
                    isCurrent ? "text-white" : "text-gray-400"
                  }`}
                >
                  {title}
                </p>
              </div>

              {/* Connector Line */}
              {stepNumber < totalSteps && (
                <div
                  className={`
                  w-12 sm:w-16 h-0.5 mx-2 sm:mx-4 mt-[-20px]
                  ${stepNumber < currentStep ? "bg-green-600" : "bg-gray-700"}
                `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Text */}
      <div className="text-center">
        <p className="text-sm text-gray-400">
          Step {currentStep} of {totalSteps}
        </p>
      </div>
    </div>
  );
}

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

// Export the progress component for use in individual pages
export { OnboardingProgress };
