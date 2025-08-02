import { Metadata } from "next";
import { VendorManagement } from "@/components/vendors/vendor-management";

export const metadata: Metadata = {
  title: "Vendor Management | Trakure",
  description: "Manage vendors and their pricing for workflow stages",
};

export default function VendorsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vendor Management</h2>
          <p className="text-muted-foreground">
            Manage vendors and configure pricing for workflow stages
          </p>
        </div>
      </div>
      <VendorManagement />
    </div>
  );
}