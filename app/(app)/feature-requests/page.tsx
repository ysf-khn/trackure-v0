"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lightbulb,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Filter,
  SortAsc,
  SortDesc,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  vote_count: number;
  user_has_voted: boolean;
  submitted_by_profile: {
    full_name: string;
  };
  created_at: string;
  updated_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "workflow", label: "Workflow" },
  { value: "reporting", label: "Reporting" },
  { value: "ui-ux", label: "UI/UX" },
  { value: "integration", label: "Integration" },
  { value: "performance", label: "Performance" },
  { value: "mobile", label: "Mobile" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { value: "vote_count", label: "Most Voted" },
  { value: "created_at", label: "Newest" },
  { value: "updated_at", label: "Recently Updated" },
  { value: "title", label: "Title" },
];

const getCategoryColor = (category: string) => {
  const colors = {
    general: "bg-gray-100 text-gray-800",
    workflow: "bg-blue-100 text-blue-800",
    reporting: "bg-green-100 text-green-800",
    "ui-ux": "bg-purple-100 text-purple-800",
    integration: "bg-orange-100 text-orange-800",
    performance: "bg-red-100 text-red-800",
    mobile: "bg-indigo-100 text-indigo-800",
  };
  return colors[category as keyof typeof colors] || colors.general;
};

const getStatusColor = (status: string) => {
  const colors = {
    submitted: "bg-yellow-100 text-yellow-800",
    under_review: "bg-blue-100 text-blue-800",
    planned: "bg-purple-100 text-purple-800",
    in_progress: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return colors[status as keyof typeof colors] || colors.submitted;
};

const getStatusIcon = (status: string) => {
  const icons = {
    submitted: Clock,
    under_review: AlertCircle,
    planned: Calendar,
    in_progress: Clock,
    completed: CheckCircle,
    rejected: XCircle,
  };
  const Icon = icons[status as keyof typeof icons] || Clock;
  return <Icon className="h-3 w-3" />;
};

export default function FeatureRequestsPage() {
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filters and sorting
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("vote_count");
  const [sortOrder, setSortOrder] = useState("desc");

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    category: "general",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchFeatureRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        category: selectedCategory,
        status: selectedStatus,
        sortBy,
        sortOrder,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/feature-requests?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch feature requests");
      }

      setFeatureRequests(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (featureRequestId: string, hasVoted: boolean) => {
    try {
      const method = hasVoted ? "DELETE" : "POST";
      const response = await fetch(
        `/api/feature-requests/${featureRequestId}/vote`,
        {
          method,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update vote");
      }

      // Update the feature request in the list
      setFeatureRequests((prev) =>
        prev.map((fr) =>
          fr.id === featureRequestId
            ? {
                ...fr,
                vote_count: data.data.vote_count,
                user_has_voted: data.data.user_has_voted,
              }
            : fr
        )
      );
    } catch (err) {
      console.error("Error updating vote:", err);
      // You might want to show a toast notification here
    }
  };

  const handleCreateFeatureRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setCreateLoading(true);
      setCreateError(null);

      const response = await fetch("/api/feature-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create feature request");
      }

      // Add the new feature request to the list
      setFeatureRequests((prev) => [data.data, ...prev]);

      // Reset form and close dialog
      setCreateForm({ title: "", description: "", category: "general" });
      setIsCreateDialogOpen(false);

      // Update pagination total
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureRequests();
  }, [selectedCategory, selectedStatus, sortBy, sortOrder, pagination.page]);

  const handleFilterChange = (type: string, value: string) => {
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page

    if (type === "category") {
      setSelectedCategory(value);
    } else if (type === "status") {
      setSelectedStatus(value);
    } else if (type === "sort") {
      setSortBy(value);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  if (loading && featureRequests.length === 0) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Lightbulb className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Feature Requests</h1>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Lightbulb className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Feature Requests</h1>
            <p className="text-muted-foreground">
              Submit and vote on feature requests to help shape the product
            </p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Feature Request</DialogTitle>
              <DialogDescription>
                Describe a new feature or improvement you'd like to see
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateFeatureRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Brief description of the feature"
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  required
                  minLength={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {createForm.title.length}/200 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed description of the feature and why it would be useful"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {createForm.description.length}/2000 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={createForm.category}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.slice(1).map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {createError && (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Request"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Sorting */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Filters:</Label>
            </div>

            <Select
              value={selectedCategory}
              onValueChange={(value) => handleFilterChange("category", value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedStatus}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Label className="text-sm font-medium">Sort by:</Label>
              <Select
                value={sortBy}
                onValueChange={(value) => handleFilterChange("sort", value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleSortOrder}
                className="px-2"
              >
                {sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Feature Requests List */}
      <div className="space-y-4">
        {featureRequests.length === 0 && !loading ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No feature requests found
              </h3>
              <p className="text-muted-foreground mb-4">
                Be the first to suggest a new feature or improvement!
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          featureRequests.map((request) => (
            <Card
              key={request.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge className={getCategoryColor(request.category)}>
                        {CATEGORIES.find((c) => c.value === request.category)
                          ?.label || request.category}
                      </Badge>
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusIcon(request.status)}
                        <span className="ml-1">
                          {STATUSES.find((s) => s.value === request.status)
                            ?.label || request.status}
                        </span>
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">
                      {request.title}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {request.description}
                    </CardDescription>
                  </div>

                  <div className="flex flex-col items-center space-y-2 ml-4">
                    <Button
                      variant={request.user_has_voted ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        handleVote(request.id, request.user_has_voted)
                      }
                      className="flex items-center space-x-1"
                    >
                      {request.user_has_voted ? (
                        <ThumbsDown className="h-4 w-4" />
                      ) : (
                        <ThumbsUp className="h-4 w-4" />
                      )}
                      <span>{request.vote_count}</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>
                        {request.submitted_by_profile?.full_name || "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </p>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>

            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
