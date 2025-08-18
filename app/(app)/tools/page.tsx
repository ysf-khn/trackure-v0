import Link from "next/link";
import { Calculator, FileText } from "lucide-react";

export default function ToolsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tools & Templates</h1>
        <p className="text-muted-foreground mt-2">
          Business tools and templates for your workflow
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* GST Calculator */}
        <Link
          href="/tools/gst-calculator"
          className="block p-6 bg-card border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <Calculator className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold">GST Calculator</h3>
          </div>
          <p className="text-muted-foreground">
            Calculate GST amounts for your transactions
          </p>
        </Link>

        {/* Purchase Order Template */}
        <Link
          href="/tools/purchase-order-template"
          className="block p-6 bg-card border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold">Purchase Order Template</h3>
          </div>
          <p className="text-muted-foreground">
            Generate purchase order documents
          </p>
        </Link>
      </div>
    </div>
  );
}
