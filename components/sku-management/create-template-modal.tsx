"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface CreateTemplateModalProps {
  sku: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateModal({
  sku,
  open,
  onOpenChange,
}: CreateTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  
  const queryClient = useQueryClient();

  const createTemplateMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const response = await fetch(`/api/sku-management/${sku}/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create template");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success("Template created successfully", {
        description: `Template "${name}" has been saved and is now active for ${sku}`,
      });
      
      // Refresh the templates data
      queryClient.invalidateQueries({ queryKey: ["sku-templates", sku] });
      queryClient.invalidateQueries({ queryKey: ["sku-details", sku] });
      
      // Reset form and close modal
      setName("");
      setDescription("");
      setError("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }
    
    setError("");
    createTemplateMutation.mutate({ name: name.trim(), description: description.trim() });
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Workflow as Template
          </DialogTitle>
          <DialogDescription>
            Create a reusable template from the current workflow configuration for SKU: <strong>{sku}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Standard Production Workflow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createTemplateMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (Optional)</Label>
            <Textarea
              id="template-description"
              placeholder="Describe when and how this template should be used..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createTemplateMutation.isPending}
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createTemplateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTemplateMutation.isPending || !name.trim()}
            >
              {createTemplateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}