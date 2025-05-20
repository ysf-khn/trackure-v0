"use client";

import React from "react";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Terminal,
  UserCircleIcon,
  BuildingIcon,
  Edit3Icon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AccountSettingsPage = () => {
  const { user, profile, organizationName, isLoading, error, refetch } =
    useProfileAndOrg();

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
        <div className="flex items-center space-x-3 mb-8">
          <UserCircleIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Account Settings</h1>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="md:col-span-1">
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center mb-4">
                <Skeleton className="h-24 w-24 rounded-full" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <UserCircleIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Account Settings</h1>
        </div>
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Account Details</AlertTitle>
          <AlertDescription>
            There was a problem fetching your account information:{" "}
            {error || "Unknown error"}. Please try refreshing the page or{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => refetch()}
            >
              try again
            </Button>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <UserCircleIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Account Settings</h1>
        </div>
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>User Information Not Found</AlertTitle>
          <AlertDescription>
            We couldn't find your profile or user information. Please try
            refreshing or{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => refetch()}
            >
              try again
            </Button>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((name) => name[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "--";

  // Placeholder for future edit functionality
  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement profile update logic (e.g., API call)
    alert("Profile update functionality not yet implemented.");
  };

  const handleImageUpload = () => {
    // TODO: Implement image upload logic
    alert("Image upload functionality not yet implemented.");
  };

  return (
    <div className="container mx-auto space-y-8">
      <div className="border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center space-x-3">
            <UserCircleIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Account Settings</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {/* Profile Card */}
          <Card className="md:col-span-1">
            <CardHeader className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-primary shadow-md">
                <AvatarImage
                  src={user.user_metadata?.avatar_url}
                  alt={profile.full_name ?? "User"}
                />
                <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImageUpload}
                className="w-full"
              >
                <Edit3Icon className="mr-2 h-3 w-3" /> Change Photo
              </Button>
            </CardHeader>
            <CardContent className="text-sm text-center">
              <p className="font-semibold text-lg">{profile.full_name}</p>
              <p className="text-muted-foreground">{user.email}</p>
              {profile.role && (
                <p className="text-muted-foreground capitalize">
                  Role: {profile.role}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Edit Profile Form Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
              <CardDescription>
                Update your display name and other personal details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" defaultValue={profile.full_name ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={user.email} disabled />
                  <p className="text-xs text-muted-foreground">
                    Email address cannot be changed here.
                  </p>
                </div>
                {/* Add more fields as needed, e.g., phone, bio */}
                <Button type="submit">Save Changes</Button>
              </form>
            </CardContent>
          </Card>

          {/* Organization Details Card */}
          {organizationName && (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BuildingIcon className="mr-2 h-5 w-5 text-primary" />{" "}
                  Organization Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg">
                  <span className="font-semibold">Organization Name:</span>{" "}
                  {organizationName}
                </p>
                {/* Add more organization details if available/needed */}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
