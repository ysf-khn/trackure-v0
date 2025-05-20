import React from "react";
import { Metadata } from "next";
import { Navbar } from "@/components/landing-page/navbar";
import { Hero } from "@/components/landing-page/hero";
import { Problems } from "@/components/landing-page/problems";
import { Solutions } from "@/components/landing-page/solutions";
import { CTA } from "@/components/landing-page/cta";
import { Footer } from "@/components/landing-page/footer";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Trakure - Export Workflows, Perfected",
  description:
    "Stop drowning in spreadsheets. Track your entire export workflow from raw items to finished products in one simple system. Get clear answers instantly with Trakure.",
  keywords:
    "export management, workflow tracking, export process, inventory management, export business software, inventory tracking, export business, export management software, export business software cost",
  openGraph: {
    title: "Trakure - Export Workflows, Perfected",
    description:
      "Stop drowning in spreadsheets. Track your entire export workflow from raw items to finished products in one simple system.",
    type: "website",
    url: "https://trakure.com",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 675,
        alt: "Trakure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trakure - Export Workflows, Perfected",
    description:
      "Stop drowning in spreadsheets. Track your entire export workflow from raw items to finished products in one simple system.",
    images: ["/twitter-image.png"],
  },
};

export default function LandingPage() {
  return (
    <main className="relative min-h-screen flex flex-col bg-black">
      <Navbar />
      <div className="flex-1">
        <Hero />
        <div className="relative">
          {/* Shared background image */}
          <div className="absolute inset-0 w-full h-full">
            <Image
              src="/bg-features.svg"
              alt="Background"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="relative">
            <Problems />
            <Solutions />
            <CTA />
          </div>
        </div>
      </div>
      <Footer />
      {/* Blur overlay at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-[3vh] bg-gradient-to-t from-black/50 to-transparent backdrop-blur-sm z-10 pointer-events-none" />
    </main>
  );
}
