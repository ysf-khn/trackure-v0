import { ArrowLeft, BookOpen, Clock, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { promises as fs } from "fs";
import path from "path";

export const metadata = {
  title: "Complete Trakure User Guide - Guides",
  description:
    "Everything you need to know about managing your export manufacturing workflow with Trakure",
};

async function getMarkdownContent() {
  try {
    const filePath = path.join(
      process.cwd(),
      "TRACKURE_COMPREHENSIVE_GUIDE.md"
    );
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (error) {
    console.error("Error reading markdown file:", error);
    return `# Complete Trackure User Guide

*Content is being loaded...*

If you're seeing this message, the guide content is being prepared. Please check back in a moment or contact support if this persists.`;
  }
}

export default async function ComprehensiveGuidePage() {
  const content = await getMarkdownContent();

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
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Complete Trakure User Guide
                    </h1>
                    <p className="text-muted-foreground">
                      Everything you need to know about managing your export
                      manufacturing workflow
                    </p>
                  </div>
                </div>

                {/* Guide Meta */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>25 min read</span>
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

          {/* Content */}
          <div className="px-4 lg:px-6">
            <Card className="p-6 md:p-8">
              <MarkdownRenderer content={content} />
            </Card>
          </div>

          {/* Navigation Footer */}
          <div className="px-4 lg:px-6 mt-8">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Ready to get started?</h3>
                  <p className="text-sm text-muted-foreground">
                    Explore more guides or jump into your workflow setup
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <Link href="/guides">More Guides</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/settings/workflow">Setup Workflow</Link>
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
