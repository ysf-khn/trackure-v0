"use client";

import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useProfileAndOrg from "@/hooks/queries/use-profileAndOrg";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { compressImage } from "@/lib/image-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Terminal,
  UserCircleIcon,
  BuildingIcon,
  Edit3Icon,
  Camera,
  Save,
  Loader2,
  Mail,
  User,
  Shield,
  Upload,
  X,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Form validation schema
const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .min(1, "Full name is required")
    .max(255, "Full name is too long"),
});

type ProfileFormValues = z.infer<typeof profileUpdateSchema>;

// API function for updating profile
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

// API function for uploading avatar
async function uploadAvatar(file: File, userId: string) {
  console.log("Starting avatar upload for user:", userId);
  console.log("Original file:", file.name, file.size, file.type);

  // Compress the image before upload
  const compressedFile = await compressImage(file, {
    maxSizeMB: 0.5, // Smaller size for avatars
    maxWidthOrHeight: 512, // Avatar size
    initialQuality: 0.8,
  });

  console.log(
    "Compressed file:",
    compressedFile.name,
    compressedFile.size,
    compressedFile.type
  );

  const formData = new FormData();
  formData.append("avatar", compressedFile);
  formData.append("userId", userId);

  console.log("Sending request to /api/profiles/avatar");

  const response = await fetch("/api/profiles/avatar", {
    method: "POST",
    body: formData,
  });

  console.log("Response status:", response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Upload error:", errorData);
    throw new Error(errorData.error || "Failed to upload avatar");
  }

  const result = await response.json();
  console.log("Upload successful:", result);
  return result.avatarUrl;
}

const AccountSettingsPage = () => {
  const { user, profile, organizationName, isLoading, error, refetch } =
    useProfileAndOrg();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Use the avatar URL hook for proper caching
  const { avatarUrl, invalidateCache } = useAvatarUrl({
    rawAvatarUrl: user?.user_metadata?.avatar_url,
    userId: user?.id,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
    },
  });

  // Update form when profile data loads
  React.useEffect(() => {
    if (profile?.full_name) {
      form.setValue("full_name", profile.full_name);
    }
  }, [profile?.full_name, form]);

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  // Avatar upload mutation
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsCompressing(true);
      try {
        return await uploadAvatar(file, user!.id);
      } finally {
        setIsCompressing(false);
      }
    },
    onSuccess: (avatarUrl: string) => {
      toast.success("Avatar updated successfully!");
      setAvatarPreview(null);
      setSelectedFile(null);

      // Invalidate the avatar cache to force refresh
      invalidateCache();

      // Force refetch user data and invalidate queries
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update avatar: ${error.message}`);
      setAvatarPreview(null);
      setSelectedFile(null);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = () => {
    if (selectedFile && user) {
      avatarMutation.mutate(selectedFile);
    }
  };

  const cancelAvatarUpload = () => {
    setAvatarPreview(null);
    setSelectedFile(null);
    setIsCompressing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 space-y-8">
        <div className="flex items-center space-x-3 mb-8">
          <UserCircleIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1">
            <CardHeader className="text-center">
              <Skeleton className="h-32 w-32 rounded-full mx-auto mb-4" />
              <Skeleton className="h-6 w-32 mx-auto mb-2" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </CardHeader>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <UserCircleIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Account Details</AlertTitle>
          <AlertDescription>
            There was a problem fetching your account information: {error}.
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center space-x-3 mb-8">
          <UserCircleIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>User Information Not Found</AlertTitle>
          <AlertDescription>
            We couldn't find your profile information.
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={() => refetch()}
            >
              Try again
            </Button>
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
    : user.email?.substring(0, 2).toUpperCase() || "??";

  // Priority order: preview (during upload) > cached avatar URL
  const displayAvatarUrl = avatarPreview || avatarUrl;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserCircleIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center pb-4">
            <div className="relative mx-auto mb-6">
              <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
                <AvatarImage
                  src={displayAvatarUrl || undefined}
                  alt={profile.full_name || "User"}
                  className="object-cover"
                  key={displayAvatarUrl} // Force re-render when URL changes
                />
                <AvatarFallback className="text-2xl font-semibold bg-primary/10">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Camera overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Avatar upload controls */}
            {selectedFile && (
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    size="sm"
                    onClick={handleAvatarUpload}
                    disabled={avatarMutation.isPending || isCompressing}
                    className="flex-1"
                  >
                    {avatarMutation.isPending || isCompressing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isCompressing
                      ? "Compressing..."
                      : avatarMutation.isPending
                        ? "Uploading..."
                        : "Upload"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelAvatarUpload}
                    disabled={avatarMutation.isPending || isCompressing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!selectedFile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Edit3Icon className="mr-2 h-4 w-4" />
                Change Photo
              </Button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </CardHeader>

          <CardContent className="text-center space-y-4">
            <div>
              <h3 className="font-semibold text-lg">
                {profile.full_name || "No name set"}
              </h3>
              <div className="flex items-center justify-center text-muted-foreground mt-1">
                <Mail className="h-4 w-4 mr-1" />
                <span className="text-sm">{user.email}</span>
              </div>
            </div>

            {profile.role && (
              <div className="flex items-center justify-center">
                <Badge variant="secondary" className="flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  {profile.role}
                </Badge>
              </div>
            )}

            <Separator />

            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
              {user.last_sign_in_at && (
                <p>
                  Last active{" "}
                  {new Date(user.last_sign_in_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information and display preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          {...field}
                          disabled={profileMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        This is how your name will appear throughout the
                        application.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={user.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email address cannot be changed here. Contact support if you
                    need to update your email.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      profileMutation.isPending || !form.formState.isDirty
                    }
                    className="min-w-[120px]"
                  >
                    {profileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Organization Details */}
        {organizationName && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BuildingIcon className="mr-2 h-5 w-5 text-primary" />
                Organization
              </CardTitle>
              <CardDescription>
                Your organization details and membership information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Organization Name
                  </Label>
                  <p className="text-lg font-semibold mt-1">
                    {organizationName}
                  </p>
                </div>
                {profile.role && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Your Role
                    </Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-sm">
                        <Shield className="h-3 w-3 mr-1" />
                        {profile.role}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AccountSettingsPage;
