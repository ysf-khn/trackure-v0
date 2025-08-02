import { Metadata } from "next";
import { SKUManagement } from "@/components/sku-management/sku-management";

export const metadata: Metadata = {
  title: "SKU Management | Trakure",
  description: "Comprehensive SKU management with cost calculations and analytics",
};

export default function SKUManagementPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">SKU Management</h2>
          <p className="text-muted-foreground">
            Comprehensive SKU analytics with cost calculations, workflows, and vendor management
          </p>
        </div>
      </div>
      <SKUManagement />
    </div>
  );
}