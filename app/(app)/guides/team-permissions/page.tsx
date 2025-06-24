import { ArrowLeft, Users, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Team Management & Permissions Guide - Guides",
  description:
    "Configure your team access and permissions for optimal security and productivity",
};

export default function TeamPermissionsGuidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex flex-col gap-4">
              <Button variant="ghost" asChild className="w-fit">
                <Link href="/guides" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Guides
                </Link>
              </Button>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Team Management & Permissions
                    </h1>
                    <p className="text-muted-foreground">
                      Configure your team access and permissions for optimal
                      security and productivity
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>10 min read</span>
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

          <div className="px-4 lg:px-6">
            <Card className="p-6 md:p-8">
              <div className="space-y-6">
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">
                    Guide Coming Soon
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Learn how to manage your team, set up roles, and configure
                    permissions for maximum security.
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
        </div>
      </div>
    </div>
  );
}
