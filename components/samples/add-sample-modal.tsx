"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const addSampleSchema = z.object({
  sample_code: z.string().min(1, "Sample code is required"),
  name: z.string().min(1, "Sample name is required"),
  description: z.string().optional(),
  sku: z.string().optional(),
  status: z.enum(['available', 'with_customer', 'in_production', 'damaged', 'lost']).default('available'),
  location: z.string().optional(),
  received_date: z.string().optional(),
  received_from: z.string().optional(),
  attributes: z.array(z.object({
    category: z.string().min(1, "Category is required"),
    name: z.string().min(1, "Attribute name is required"),
    value: z.string().min(1, "Value is required"),
    unit: z.string().optional(),
  })).default([]),
});

type AddSampleForm = z.infer<typeof addSampleSchema>;

interface AddSampleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const attributeCategories = [
  'physical',
  'visual', 
  'material',
  'finishing',
  'packaging',
  'custom'
];

export function AddSampleModal({ open, onOpenChange }: AddSampleModalProps) {
  const queryClient = useQueryClient();
  
  const form = useForm<AddSampleForm>({
    resolver: zodResolver(addSampleSchema),
    defaultValues: {
      sample_code: "",
      name: "",
      description: "",
      sku: "",
      status: 'available',
      location: "",
      received_date: "",
      received_from: "",
      attributes: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  const createSampleMutation = useMutation({
    mutationFn: async (data: AddSampleForm) => {
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sample");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      toast.success("Sample created successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sample: ${error.message}`);
    },
  });

  const onSubmit = (data: AddSampleForm) => {
    createSampleMutation.mutate(data);
  };

  const addAttribute = () => {
    append({
      category: 'physical',
      name: '',
      value: '',
      unit: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Sample</DialogTitle>
          <DialogDescription>
            Create a new sample to track with flexible attributes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sample_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sample Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter unique sample code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sample Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter sample name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter sample description"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Associated SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter SKU if applicable" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="with_customer">With Customer</SelectItem>
                          <SelectItem value="in_production">In Production</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Where is the sample stored?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="received_from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received From</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer, vendor, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="received_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Attributes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Sample Attributes</h3>
                <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attribute
                </Button>
              </div>

              {fields.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-6">
                    <p className="text-muted-foreground">
                      No attributes added yet. Click "Add Attribute" to add properties like dimensions, color, material, etc.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <Card key={field.id}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <FormField
                            control={form.control}
                            name={`attributes.${index}.category`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {attributeCategories.map((cat) => (
                                      <SelectItem key={cat} value={cat}>
                                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`attributes.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., length, color" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`attributes.${index}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Value</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., 10, red" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex gap-2">
                            <FormField
                              control={form.control}
                              name={`attributes.${index}.unit`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel>Unit</FormLabel>
                                  <FormControl>
                                    <Input placeholder="mm, kg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="pt-8">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createSampleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSampleMutation.isPending}
              >
                {createSampleMutation.isPending ? "Creating..." : "Create Sample"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}