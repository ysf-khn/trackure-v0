export const plans = [
  {
    title: "ESSENTIALS",
    monthlyPrice: 1499,
    annualPrice: 1249,
    monthlyProductId: "pdt_h4be8YwBSFeIsVq1uUtUc",
    annualProductId: "pdt_VICMPy52bLjhP2FawRlJj",
    description:
      "Perfect for small teams and getting started with clear workflow tracking.",
    keyFeatures: [
      { text: "Up to 3 Users (1 Owner, 2 Workers)" },
      { text: "Up to 3 Active Orders / month" },
      { text: "Up to 100 Active Items / month" },
      { text: "Email Support" },
      { text: "Core Features Only" },
    ],
    limits: {
      maxUsers: 3,
      maxActiveOrdersPerMonth: 3,
      maxActiveItemsPerMonth: 10000,
    },
  },
  {
    title: "PROFESSIONAL",
    monthlyPrice: 3999,
    annualPrice: 3332,
    monthlyProductId: "pdt_7QuM9btVBTzDdbb3s1c5k",
    annualProductId: "pdt_CyczWOHkO228qPDNCryqn",
    description:
      "Ideal for growing businesses needing more capacity and user access.",
    isPopular: true,
    keyFeatures: [
      { text: "Up to 10 Users (Configurable Owner/Worker Mix)" },
      { text: "Up to 20 Active Orders / month" },
      { text: "Up to 500 Active Items / month" },
      { text: "Priority Email Support" },
      { text: "Access to New Features" },
    ],
    limits: {
      maxUsers: 10,
      maxActiveOrdersPerMonth: 20,
      maxActiveItemsPerMonth: 10000,
    },
  },
  {
    title: "BUSINESS",
    monthlyPrice: 8999,
    annualPrice: 7499,
    monthlyProductId: "pdt_IQPwKetwS6DaEjfcxwmIp",
    annualProductId: "pdt_zjVfwEQpR86QBZrPayX6T",
    description:
      "For larger export operations requiring higher volumes and more users.",
    keyFeatures: [
      { text: "Up to 25 Users (Configurable Owner/Worker Mix)" },
      { text: "Up to 75 Active Orders / month" },
      { text: "Up to 2,000 Active Items / month" },
      { text: "Chat & Priority Email Support" },
      { text: "Access to New Features" },
    ],
    limits: {
      maxUsers: 25,
      maxActiveOrdersPerMonth: 75,
      maxActiveItemsPerMonth: 10000,
    },
  },
];

export interface PlanLimits {
  maxUsers: number;
  maxActiveOrdersPerMonth: number;
  maxActiveItemsPerMonth: number;
}

// Default limits for users without a subscription (should be very restrictive)
export const DEFAULT_LIMITS: PlanLimits = {
  maxUsers: 1,
  maxActiveOrdersPerMonth: 1,
  maxActiveItemsPerMonth: 10,
};

/**
 * Get plan limits based on product ID
 * @param productId - The product ID from the subscription
 * @returns PlanLimits object or default limits if not found
 */
export function getPlanLimitsByProductId(
  productId: string | null | undefined
): PlanLimits {
  if (!productId) {
    return DEFAULT_LIMITS;
  }

  const plan = plans.find(
    (p) => p.monthlyProductId === productId || p.annualProductId === productId
  );

  return plan?.limits || DEFAULT_LIMITS;
}

/**
 * Get plan title based on product ID
 * @param productId - The product ID from the subscription
 * @returns Plan title or "Unknown Plan" if not found
 */
export function getPlanTitleByProductId(
  productId: string | null | undefined
): string {
  if (!productId) {
    return "No Plan";
  }

  const plan = plans.find(
    (p) => p.monthlyProductId === productId || p.annualProductId === productId
  );

  return plan?.title || "Unknown Plan";
}
