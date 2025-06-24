"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { OnboardingProgress } from "../../layout";
import { User } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(255),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

async function updateProfile(data: ProfileFormValues) {
  const response = await fetch("/api/profiles/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update profile");
  }

  return response.json();
}

export function ProfileForm() {
  const router = useRouter();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Profile updated!");
      router.push("/organization");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
      console.error("Profile update mutation failed:", error);
    },
  });

  function onSubmit(values: ProfileFormValues) {
    mutation.mutate(values);
  }

  const stepTitles = ["Your Profile", "Organization", "Workflow Setup"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      {/* Progress Indicator */}
      <OnboardingProgress
        currentStep={1}
        totalSteps={3}
        stepTitles={stepTitles}
      />

      {/* Main Content */}
      <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-lg shadow-md">
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="p-3 bg-primary/20 rounded-full">
              <User className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome to Trackure!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Let's start by setting up your profile. This will only take a
              moment.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ada Lovelace" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is how your name will appear throughout Trackure.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white shadow-sm"
              disabled={mutation.isPending}
              size="lg"
            >
              {mutation.isPending ? "Saving..." : "Save and Continue"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
