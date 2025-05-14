"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { ImageUploader } from "../ui/image-uploader";

// Define Zod schema for form validation
const remarkFormSchema = z.object({
  text: z
    .string()
    .min(1, "Remark cannot be empty")
    .max(1000, "Remark is too long"),
});

type RemarkFormData = z.infer<typeof remarkFormSchema>;

// Define expected type for the remark returned by the API
interface CreatedRemark {
  id: string;
  // Include other fields if needed, e.g., text, timestamp
}

interface AddRemarkModalProps {
  itemId: string;
  children: React.ReactNode; // To wrap the trigger element
}

// API call function expects the created remark object as response
async function addRemarkApi(
  itemId: string,
  data: RemarkFormData
): Promise<CreatedRemark> {
  const response = await fetch(`/api/items/${itemId}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to add remark");
  }
  return response.json();
}

export function AddRemarkModal({ itemId, children }: AddRemarkModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [createdRemarkId, setCreatedRemarkId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    organizationId,
    isLoading: isAuthLoading,
    error: authError,
  } = useProfileAndOrg();

  const form = useForm<RemarkFormData>({
    resolver: zodResolver(remarkFormSchema),
    defaultValues: {
      text: "",
    },
  });

  const mutation = useMutation<CreatedRemark, Error, RemarkFormData>({
    mutationFn: (data: RemarkFormData) => addRemarkApi(itemId, data),
    onSuccess: (newRemark) => {
      toast.success("Remark text saved successfully!");
      console.log(newRemark.id);
      setCreatedRemarkId(newRemark.id);
      queryClient.invalidateQueries({ queryKey: ["itemRemarks", itemId] });
      queryClient.invalidateQueries({ queryKey: ["itemHistory", itemId] });
    },
    onError: (error) => {
      toast.error(`Error saving remark: ${error.message}`);
      setCreatedRemarkId(null);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setCreatedRemarkId(null);
    }
  }, [isOpen, form]);

  function onSubmit(data: RemarkFormData) {
    if (!createdRemarkId) {
      mutation.mutate(data);
    }
  }

  const handleClose = () => {
    setIsOpen(false);
    form.reset();
    setCreatedRemarkId(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Remark</DialogTitle>
          <DialogDescription>
            Add a text remark for this item. You can attach an image after
            saving the text.
          </DialogDescription>
        </DialogHeader>

        {(isAuthLoading || authError || !organizationId) &&
          !createdRemarkId && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {isAuthLoading
                  ? "Loading user data..."
                  : authError
                    ? `Authentication error: ${authError}`
                    : "Could not determine organization ID. Cannot upload images."}
              </AlertDescription>
            </Alert>
          )}

        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remark Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your remark here..."
                      rows={4}
                      {...field}
                      disabled={mutation.isPending || !!createdRemarkId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {createdRemarkId && organizationId && (
              <div className="pt-4">
                <Separator className="mb-4" />
                <ImageUploader
                  itemId={itemId}
                  organizationId={organizationId}
                  remarkId={createdRemarkId}
                  onUploadComplete={() => {
                    toast.info("Image attached successfully.");
                  }}
                  disabled={mutation.isPending}
                />
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              {!createdRemarkId && (
                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={mutation.isPending || !form.formState.isValid}
                >
                  {mutation.isPending ? "Saving Text..." : "Save Remark Text"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
