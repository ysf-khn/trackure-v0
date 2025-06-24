import { ArrowLeft, Workflow, Clock, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Workflow Customization Guide - Guides",
  description:
    "Learn how to set up and customize your workflow stages for maximum efficiency",
};

export default function WorkflowGuidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header Section */}
          <div className="px-4 lg:px-6">
            <div className="flex flex-col gap-4">
              {/* Back Button */}
              <Button variant="ghost" asChild className="w-fit">
                <Link href="/guides" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Guides
                </Link>
              </Button>

              {/* Guide Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Workflow className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Workflow Customization Guide
                    </h1>
                    <p className="text-muted-foreground">
                      Learn how to set up and customize your workflow stages for
                      maximum efficiency
                    </p>
                  </div>
                </div>

                {/* Guide Meta */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>12 min read</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>For administrators</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-yellow-100 text-yellow-800 border-yellow-200"
                  >
                    Intermediate
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 lg:px-6">
            <Card className="p-6 md:p-8">
              <div className="space-y-6">
                <div className="text-center py-12">
                  <Workflow className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">
                    Guide Coming Soon
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    We're working on creating detailed guides for all aspects of
                    Trackure. This workflow customization guide will be
                    available soon.
                  </p>
                  <div className="mt-6">
                    <Button asChild>
                      <Link href="/guides/comprehensive">
                        Read the Complete Guide
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Navigation Footer */}
          <div className="px-4 lg:px-6 mt-8">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    Need help with workflow setup?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Start with the comprehensive guide or go directly to
                    settings
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <Link href="/guides/comprehensive">Complete Guide</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/settings/workflow">Workflow Settings</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
