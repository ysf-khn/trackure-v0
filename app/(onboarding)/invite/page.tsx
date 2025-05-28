"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

// Zod schema for form validation
const inviteFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  full_name: z.string().min(1, "Please enter the member's full name."),
  role: z.enum(["Worker"], { required_error: "Role is required." }), // Only allow 'Worker' for now
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

// Placeholder functions for API calls - replace with actual implementations
// Assume these functions handle the actual fetch/axios calls
const sendTeamInvite = async (data: InviteFormData): Promise<void> => {
  const response = await fetch("/api/team/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // Catch potential JSON parsing errors
    throw new Error(
      errorData.error || `Failed to send invite (${response.status})`
    );
  }
  // Simulating API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

const completeOnboarding = async (): Promise<void> => {
  const response = await fetch("/api/onboarding/complete", { method: "POST" });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to complete onboarding (${response.status})`
    );
  }
  // Simulating API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export default function InviteTeamPage() {
  const router = useRouter();

  // Setup React Hook Form
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "Worker", // Default role
    },
  });

  // Setup Mutations
  const sendInviteMutation = useMutation({
    mutationFn: sendTeamInvite,
    onSuccess: () => {
      toast.success("Invite Sent", {
        description: `Successfully sent invite to ${form.getValues("email")}.`,
      });
      form.resetField("email"); // Clear email field after successful invite
      form.resetField("full_name"); // Clear full name field after successful invite
    },
    onError: (error: Error) => {
      toast.error("Invite Failed", {
        description:
          error.message || "Could not send invite. Please try again.",
      });
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      toast.info("Setup complete! Redirecting to dashboard...");
      router.push("/dashboard");
    },
    onError: (error: Error) => {
      toast.error("Error Finishing Setup", {
        description:
          error.message || "Could not complete setup. Please try again.",
      });
    },
  });

  // Form submit handler
  const onSubmit = (data: InviteFormData) => {
    sendInviteMutation.mutate(data);
  };

  // Skip/Finish button handler
  const handleFinishSetup = () => {
    completeOnboardingMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invite Your Team (Optional)</CardTitle>
          <CardDescription>
            Add your team members now, or you can do this later from the
            settings.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="member@example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the email address of the person to invite.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the full name of the person to invite.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* Currently only Worker role during onboarding */}
                        <SelectItem value="Worker">Worker</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Assign a role.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={sendInviteMutation.isPending}
                className="w-full"
              >
                {sendInviteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invite
              </Button>
              {/* <CardFooter className="flex flex-col items-stretch space-y-2 border-t pt-4 mt-4"> */}
              <Button
                variant="outline"
                onClick={handleFinishSetup}
                disabled={completeOnboardingMutation.isPending}
                className="w-full"
              >
                {completeOnboardingMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Skip and Finish Setup
              </Button>
            </CardContent>
            {/* </CardFooter> */}
          </form>
        </Form>
      </Card>
    </div>
  );
}
