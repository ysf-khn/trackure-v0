"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { VendorPricingSection, type VendorPricingData } from "./vendor-pricing-section";
import { getWorkflowQueryKey } from "@/hooks/queries/use-workflow-structure";
import { getSidebarWorkflowKey } from "@/hooks/queries/use-workflow";
import type { FetchedWorkflowStage } from "@/hooks/queries/use-workflow-structure";

const vendorPricingSchema = z.object({
  vendor_id: z.string().min(1, "Vendor is required"),
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.string().min(1, "Currency is required"),
  price_unit: z.string().min(1, "Price unit is required"),
  minimum_quantity: z.number().int().min(1, "Minimum quantity must be at least 1"),
  lead_time_days: z.number().int().min(0, "Lead time cannot be negative"),
  notes: z.string().optional(),
});

const formSchema = z.object({
  vendorPricing: z.array(vendorPricingSchema),
});

type FormData = z.infer<typeof formSchema>;

interface VendorPricingModalProps {
  organizationId: string;
  selectedSKU: string | null;
  stage: FetchedWorkflowStage | null;
  isOpen: boolean;
  onClose: () => void;
}

async function fetchVendorPricing(stageId: string) {
  const response = await fetch(`/api/settings/workflow/stages/${stageId}/vendor-pricing`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch vendor pricing");
  }
  return response.json();
}

async function updateVendorPricing(stageId: string, sku: string, vendorPricing: VendorPricingData[]) {
  const response = await fetch(`/api/settings/workflow/stages/${stageId}/vendor-pricing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vendorPricing, sku }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update vendor pricing");
  }
  return response.json();
}

export function VendorPricingModal({
  organizationId,
  selectedSKU,
  stage,
  isOpen,
  onClose,
}: VendorPricingModalProps) {
  const queryClient = useQueryClient();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorPricing: [],
    },
  });

  // Fetch existing vendor pricing when modal opens
  const { data: vendorPricingData, isLoading } = useQuery({
    queryKey: ["vendor-pricing", stage?.id],
    queryFn: () => fetchVendorPricing(stage!.id),
    enabled: isOpen && !!stage?.id,
  });

  // Reset form when vendor pricing data is loaded
  useEffect(() => {
    if (vendorPricingData?.vendorPricing) {
      const formattedPricing = vendorPricingData.vendorPricing.map((pricing: any) => ({
        vendor_id: pricing.vendor_id,
        price: pricing.price,
        currency: pricing.currency,
        price_unit: pricing.price_unit,
        minimum_quantity: pricing.minimum_quantity,
        lead_time_days: pricing.lead_time_days,
        notes: pricing.notes || "",
      }));
      form.reset({ vendorPricing: formattedPricing });
    } else {
      form.reset({ vendorPricing: [] });
    }
  }, [vendorPricingData, form]);

  const mutation = useMutation({
    mutationFn: (values: FormData) => {
      if (!stage?.id || !selectedSKU) throw new Error("Stage ID or SKU is missing");
      return updateVendorPricing(stage.id, selectedSKU, values.vendorPricing);
    },
    onSuccess: () => {
      toast.success("Vendor pricing updated successfully!");
      queryClient.invalidateQueries({
        queryKey: getWorkflowQueryKey(organizationId, selectedSKU),
      });
      queryClient.invalidateQueries({
        queryKey: getSidebarWorkflowKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: ["vendor-pricing", stage?.id],
      });
      onClose();
    },
    onError: (error) => {
      toast.error(`Error updating vendor pricing: ${error.message}`);
    },
  });

  const onSubmit = (values: FormData) => {
    mutation.mutate(values);
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    form.reset();
    onClose();
  };

  if (!stage || !selectedSKU) return null;

  // Only show for leaf stages
  if (!stage.is_leaf_stage) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vendor Pricing Not Available</DialogTitle>
            <DialogDescription>
              Vendor pricing can only be configured for leaf stages (stages without sub-stages).
              This stage has sub-stages, so vendor pricing should be configured on the individual sub-stages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Vendor Pricing</DialogTitle>
          <DialogDescription>
            Configure vendor pricing for stage &quot;{stage.name}&quot; (SKU: {selectedSKU})
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Loading vendor pricing...</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <VendorPricingSection
                control={form.control}
                selectedSKU={selectedSKU}
                isLeafStage={stage.is_leaf_stage}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="bg-primary text-white"
                >
                  {mutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}