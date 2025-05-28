"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  BuildingIcon,
  UserPlusIcon,
  UsersIcon,
  Loader2,
  MailIcon,
  ShieldIcon,
  TrashIcon,
  EditIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";

// Types
interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
  email?: string;
  created_at: string;
}

// Schemas
const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  full_name: z.string().min(1, "Please enter the member's full name."),
  role: z.enum(["Owner", "Worker"], {
    required_error: "Please select a role.",
  }),
});

type InviteFormData = z.infer<typeof inviteSchema>;

// API Functions
async function fetchTeamMembers(organizationId: string): Promise<TeamMember[]> {
  const response = await fetch(`/api/organizations/${organizationId}/members`);

  if (!response.ok) {
    throw new Error("Failed to fetch team members");
  }

  return response.json();
}

async function sendInvite(data: InviteFormData): Promise<void> {
  const response = await fetch("/api/team/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send invite");
  }
}

async function removeMember(memberId: string): Promise<void> {
  const response = await fetch(`/api/team/members/${memberId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to remove member");
  }
}

export default function OrganizationSettingsPage() {
  const { user, profile, organizationName, organizationId, isLoading, error } =
    useProfileAndOrg();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Team members query
  const {
    data: teamMembers,
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ["teamMembers", organizationId],
    queryFn: () => fetchTeamMembers(organizationId!),
    enabled: !!organizationId,
  });

  // Invite form
  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "Worker",
    },
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: sendInvite,
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      inviteForm.reset();
      setIsInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["teamMembers"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to send invitation", {
        description: error.message,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      toast.success("Member removed successfully!");
      queryClient.invalidateQueries({ queryKey: ["teamMembers"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to remove member", {
        description: error.message,
      });
    },
  });

  // Handlers
  const handleInvite = (data: InviteFormData) => {
    inviteMutation.mutate(data);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (
      confirm(
        `Are you sure you want to remove ${memberName} from the organization?`
      )
    ) {
      removeMutation.mutate(memberId);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <BuildingIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Organization</h1>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-8 space-y-8">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !organizationId) {
    return (
      <div className="container mx-auto space-y-8">
        <div className="border-b">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3">
              <BuildingIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Organization</h1>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-8">
          <Alert variant="destructive">
            <BuildingIcon className="h-4 w-4" />
            <AlertTitle>Organization Not Found</AlertTitle>
            <AlertDescription>
              {error ||
                "We couldn't find an organization associated with your account."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const isOwner = profile?.role === "Owner";

  return (
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center space-x-3">
            <BuildingIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Organization</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-8">
        {/* Organization Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BuildingIcon className="mr-2 h-5 w-5 text-primary" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Manage your organization settings and information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Organization Name
                </label>
                <p className="text-lg font-semibold mt-1">{organizationName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Your Role
                </label>
                <div className="mt-1">
                  <Badge variant="outline" className="text-sm">
                    <ShieldIcon className="h-3 w-3 mr-1" />
                    {profile?.role}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <UsersIcon className="mr-2 h-5 w-5 text-primary" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Manage your organization's team members and their roles.
                </CardDescription>
              </div>
              {isOwner && (
                <Dialog
                  open={isInviteDialogOpen}
                  onOpenChange={setIsInviteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlusIcon className="mr-2 h-4 w-4" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Send an invitation to add a new member to your
                        organization.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...inviteForm}>
                      <form
                        onSubmit={inviteForm.handleSubmit(handleInvite)}
                        className="space-y-4"
                      >
                        <FormField
                          control={inviteForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="member@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Enter the email address of the person you want
                                to invite.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inviteForm.control}
                          name="full_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Doe" {...field} />
                              </FormControl>
                              <FormDescription>
                                Enter the full name of the person you want to
                                invite.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inviteForm.control}
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
                                  <SelectItem value="Worker">Worker</SelectItem>
                                  <SelectItem value="Owner">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Choose the role for the new team member.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsInviteDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={inviteMutation.isPending}
                          >
                            {inviteMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Send Invitation
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : membersError ? (
              <Alert variant="destructive">
                <AlertTitle>Error Loading Team Members</AlertTitle>
                <AlertDescription>
                  Failed to load team members. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    {isOwner && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers?.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <ShieldIcon className="mr-1 h-3 w-3" />
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          {member.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveMember(
                                  member.id,
                                  member.full_name || "this member"
                                )
                              }
                              disabled={removeMutation.isPending}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
