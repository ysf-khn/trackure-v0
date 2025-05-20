import React from "react";
import { Navbar } from "@/components/landing-page/navbar";
import { Hero } from "@/components/landing-page/hero";
import { Problems } from "@/components/landing-page/problems";
import { Solutions } from "@/components/landing-page/solutions";
import { CTA } from "@/components/landing-page/cta";
import { Footer } from "@/components/landing-page/footer";
import Image from "next/image";

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
