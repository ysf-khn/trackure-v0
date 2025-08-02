import { Metadata } from "next";
import { SampleTracking } from "@/components/samples/sample-tracking";

export const metadata: Metadata = {
  title: "Sample Management | Trakure",
  description: "Track and manage physical samples with attributes and movement history",
};

export default function SamplesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sample Management</h2>
          <p className="text-muted-foreground">
            Track physical samples with flexible attributes and movement history
          </p>
        </div>
      </div>
      <SampleTracking />
    </div>
  );
}