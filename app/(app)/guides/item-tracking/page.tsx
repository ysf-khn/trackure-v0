import { ArrowLeft, Package, Clock, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Item Movement & Tracking Guide - Guides",
  description:
    "Master the core functionality of moving items through your workflow",
};

export default function ItemTrackingGuidePage() {
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
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Item Movement & Tracking
                    </h1>
                    <p className="text-muted-foreground">
                      Master the core functionality of moving items through your
                      workflow
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>15 min read</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>For all users</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    Beginner
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 lg:px-6">
            <Card className="p-6 md:p-8">
              <div className="space-y-6">
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">
                    Guide Coming Soon
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    This guide will cover all aspects of item movement, bulk
                    operations, and tracking functionality.
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
