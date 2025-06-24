"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Workflow } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ItemDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: {
    id: string;
    sku: string;
    instance_details: Record<string, unknown>;
    composite_group_id?: string | null;
    parent_composite_sku?: string | null;
  } | null;
  itemName?: string | null; // Optional: for a more descriptive title
}

interface ParentCompositeDetails {
  sku: string;
  instance_details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  total_quantity: number;
  remaining_quantity: number;
  status: string;
  component_count?: number;
  composite_name?: string | null;
  composite_description?: string | null;
}

// Helper function to format attribute keys
const formatAttributeKey = (key: string): string => {
  // Handle snake_case to "Title Case"
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Function to fetch parent composite details
const fetchParentCompositeDetails = async (
  compositeGroupId: string,
  parentCompositeSku: string
): Promise<ParentCompositeDetails | null> => {
  const response = await fetch(
    `/api/composite-items/parent-details?composite_group_id=${compositeGroupId}&parent_composite_sku=${parentCompositeSku}`
  );

  if (!response.ok) {
    console.error("Failed to fetch parent composite details");
    return null;
  }

  return response.json();
};

export function ItemDetailsModal({
  isOpen,
  onOpenChange,
  item,
  itemName,
}: ItemDetailsModalProps) {
  // Fetch parent composite details if item is part of a composite
  const {
    data: parentComposite,
    error: parentCompositeError,
    isLoading: isLoadingParentComposite,
  } = useQuery({
    queryKey: [
      "parentComposite",
      item?.composite_group_id,
      item?.parent_composite_sku,
    ],
    queryFn: () =>
      fetchParentCompositeDetails(
        item!.composite_group_id!,
        item!.parent_composite_sku!
      ),
    enabled: !!(
      item?.composite_group_id &&
      item?.parent_composite_sku &&
      isOpen
    ),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Debug logging
  React.useEffect(() => {
    if (isOpen && item?.parent_composite_sku) {
      console.log("Modal opened for composite component:", {
        sku: item.sku,
        parent_composite_sku: item.parent_composite_sku,
        composite_group_id: item.composite_group_id,
        parentCompositeData: parentComposite,
        error: parentCompositeError,
        isLoading: isLoadingParentComposite,
      });
    }
  }, [
    isOpen,
    item,
    parentComposite,
    parentCompositeError,
    isLoadingParentComposite,
  ]);

  if (!item) return null;

  const detailEntries = Object.entries(item.instance_details);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Details for {itemName || item.sku}
            {item.parent_composite_sku && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30"
              >
                Component of {item.parent_composite_sku}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {item.parent_composite_sku
              ? "View component details and parent composite information."
              : "Specific attributes and values for this item instance."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          {item.parent_composite_sku ? (
            // Show tabs when item is part of a composite
            <Tabs defaultValue="component" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="component">Component Details</TabsTrigger>
                <TabsTrigger value="parent">
                  Parent Composite Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="component" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Component: {item.sku}
                    </h3>
                  </div>
                  {detailEntries.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Attribute</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailEntries.map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium">
                              {formatAttributeKey(key)}
                            </TableCell>
                            <TableCell>{String(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No component details available
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="parent" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Workflow className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Parent Composite:{" "}
                      {parentComposite?.composite_name ||
                        item.parent_composite_sku}
                    </h3>
                    {parentComposite?.composite_name && (
                      <span className="text-sm text-muted-foreground">
                        ({item.parent_composite_sku})
                      </span>
                    )}
                  </div>

                  {isLoadingParentComposite ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Loading parent composite details...
                      </p>
                    </div>
                  ) : parentCompositeError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive">
                        Failed to load parent composite details
                      </p>
                      <p className="text-muted-foreground text-sm mt-2">
                        {parentCompositeError.message}
                      </p>
                    </div>
                  ) : parentComposite ? (
                    <>
                      {/* Parent composite basic info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">
                            Status:
                          </span>
                          <div className="font-medium">
                            <Badge
                              variant={
                                parentComposite.status === "Completed"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {parentComposite.status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">
                            Total Quantity:
                          </span>
                          <div className="font-medium">
                            {parentComposite.total_quantity}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">
                            Remaining:
                          </span>
                          <div className="font-medium">
                            {parentComposite.remaining_quantity}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">
                            Progress:
                          </span>
                          <div className="font-medium">
                            {parentComposite.total_quantity > 0
                              ? Math.round(
                                  ((parentComposite.total_quantity -
                                    parentComposite.remaining_quantity) /
                                    parentComposite.total_quantity) *
                                    100
                                )
                              : 0}
                            %
                          </div>
                        </div>
                      </div>

                      {/* Parent composite instance details */}
                      {parentComposite.instance_details &&
                      Object.keys(parentComposite.instance_details).length >
                        0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[150px]">
                                Attribute
                              </TableHead>
                              <TableHead>Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(
                              parentComposite.instance_details
                            ).map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell className="font-medium">
                                  {formatAttributeKey(key)}
                                </TableCell>
                                <TableCell>{String(value)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No parent composite instance details available
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No parent composite details found
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            // Show single details view for non-composite items
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Attribute</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailEntries.length > 0 ? (
                  detailEntries.map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        {formatAttributeKey(key)}
                      </TableCell>
                      <TableCell>{String(value)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground"
                    >
                      No details available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
