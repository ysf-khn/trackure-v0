import React from "react";
import { Check } from "lucide-react";

interface Feature {
  name: string;
  essentials: boolean;
  professional: boolean;
  business: boolean;
}

interface Category {
  name: string;
  features: Feature[];
}

interface ComparisonData {
  categories: Category[];
}

interface PricingComparisonProps {
  comparison: ComparisonData;
  plans: any[];
}

export function PricingComparison({
  comparison,
  plans,
}: PricingComparisonProps) {
  return (
    <div className="mt-24 mb-16">
      <h2 className="text-3xl font-bold text-white text-center mb-12">
        Compare All Features
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-4 px-6 text-gray-400 font-medium">
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.title}
                  className="text-center py-4 px-6 text-white font-medium"
                >
                  {plan.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.categories.map((category, categoryIndex) => (
              <React.Fragment key={category.name}>
                <tr>
                  <td
                    colSpan={4}
                    className="text-lg font-semibold text-white py-6 px-6"
                  >
                    {category.name}
                  </td>
                </tr>
                {category.features.map((feature, featureIndex) => (
                  <tr
                    key={`${categoryIndex}-${featureIndex}`}
                    className="border-t border-gray-800"
                  >
                    <td className="py-4 px-6 text-gray-300">{feature.name}</td>
                    <td className="text-center py-4 px-6">
                      {feature.essentials && (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-4 px-6">
                      {feature.professional && (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-4 px-6">
                      {feature.business && (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
