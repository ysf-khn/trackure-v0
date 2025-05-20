import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export const Hero = () => {
  return (
    <>
      <div
        id="hero-section"
        className="relative w-full overflow-hidden bg-black"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-black to-black"></div>

        {/* Hero content */}
        <div className="container relative z-10 mx-auto px-4 pt-32 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center text-center">
            {/* Glowing orb effect */}
            <div className="absolute -top-32 left-1/2 h-56 w-56 -translate-x-1/2 transform rounded-full bg-blue-500/20 blur-3xl"></div>

            {/* Pill badge */}
            <div className="mb-6 rounded-full bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-200">
              For Growing Export Businesses
            </div>

            <h1 className="max-w-4xl bg-gradient-to-r from-white via-gray-100 to-blue-100 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl md:text-7xl">
              Stop Drowning in Spreadsheets. See Your Whole Export Process.
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-gray-400">
              Get clear answers instantly with Trackure. One simple system to
              track your entire workflow - from raw items to finished products,
              so you can export with confidence. Try it free.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4">
              <Button
                size="lg"
                className="group bg-blue-600 px-6 text-white hover:bg-blue-700"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              <span className="text-sm text-gray-500">
                No credit card needed.
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard section with background */}
        <div className="relative my-20">
          {/* Full-width background image */}
          <div className="absolute inset-x-0 -top-[7.5%] h-[800px] w-full z-10">
            <Image
              src="/Background.svg"
              alt="Background Pattern"
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Dashboard container */}
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-xl border border-gray-800/50 bg-black/50 p-2 backdrop-blur-sm">
              <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-500/20 to-blue-900/20 blur-sm"></div>
              <div className="relative rounded-lg overflow-hidden">
                <Image
                  src="/dashboard-preview.png"
                  alt="Trackure Dashboard Preview"
                  width={1200}
                  height={675}
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
