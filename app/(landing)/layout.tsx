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
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
