import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Trakure | Export Workflows, Perfected",
  description:
    "Choose the right Trakure plan for your export business. From small teams to large operations, we have flexible pricing options to suit your needs.",
  keywords:
    "trakure pricing, export management pricing, workflow software pricing, export business software cost, inventory tracking, inventory management, export business, export management software",
  openGraph: {
    title: "Pricing - Trakure | Export Workflows, Perfected",
    description:
      "Choose the right Trakure plan for your export business. From small teams to large operations, we have flexible pricing options to suit your needs.",
    type: "website",
    url: "https://trakure.com/pricing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - Trakure | Export Workflows, Perfected",
    description:
      "Choose the right Trakure plan for your export business. From small teams to large operations, we have flexible pricing options to suit your needs.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
