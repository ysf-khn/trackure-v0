import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://trakure.com"),
  applicationName: "Trakure",
  authors: [{ name: "Trakure" }],
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  creator: "Trakure",
  publisher: "Trakure",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  verification: {
    google: "google-site-verification-code", // Replace with actual code
  },
  alternates: {
    canonical: "https://trakure.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://trakure.com",
    siteName: "Trakure",
    title: "Trakure - Export Workflows, Perfected",
    description:
      "Stop drowning in spreadsheets. Track your entire export workflow from raw items to finished products in one simple system.",
    images: [
      {
        url: "https://trakure.com/og-image.png", // Make sure this image exists in your public folder
        width: 1200,
        height: 630,
        alt: "Trakure Platform Preview",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trakure - Export Workflows, Perfected",
    description:
      "Stop drowning in spreadsheets. Track your entire export workflow from raw items to finished products in one simple system.",
    images: ["https://trakure.com/og-image.png"], // Same image as OG
    creator: "@trakure",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
