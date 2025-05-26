import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="relative py-16 bg-black">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Experience Effortless Item Tracking.
            <br />
            Your Free Trial Awaits.
          </h2>
          <p className="mb-8 text-lg text-gray-400">
            Imagine less stress, fewer delays, and happier buyers. It starts
            with clear tracking.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/pricing"
              className="group flex items-center gap-2 px-8 py-3 text-lg font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Start 14-Day Free Trial{" "}
              <ArrowRight className="ml-2 h-4 w-4  transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <p className="text-sm text-gray-500">
              ₹0.00 due today, cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
