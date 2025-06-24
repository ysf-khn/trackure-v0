import {
  BookOpen,
  ExternalLink,
  FileText,
  Users,
  Workflow,
  Package,
  Settings,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function GuidesPage() {
  const guides = [
    {
      id: "comprehensive-guide",
      title: "Complete Trakure User Guide",
      description:
        "Everything you need to know about managing your export manufacturing workflow with Trakure",
      icon: <BookOpen className="h-6 w-6" />,
      category: "Getting Started",
      readTime: "25 min read",
      difficulty: "Beginner",
      href: "/guides/comprehensive",
      highlights: [
        "What Trakure is and how it transforms your export manufacturing business",
        "Complete feature deep dive with real examples",
        "Step-by-step onboarding guide",
        "Advanced tips and best practices",
      ],
    },
    {
      id: "workflow-management",
      title: "Workflow Customization Guide",
      description:
        "Learn how to set up and customize your workflow stages for maximum efficiency",
      icon: <Workflow className="h-6 w-6" />,
      category: "Workflow",
      readTime: "12 min read",
      difficulty: "Intermediate",
      href: "/guides/workflow",
      highlights: [
        "Default workflow setup",
        "Creating custom stages and sub-stages",
        "Best practices for workflow design",
        "Common workflow patterns by industry",
      ],
    },
    {
      id: "item-tracking",
      title: "Item Movement & Tracking",
      description:
        "Master the core functionality of moving items through your workflow",
      icon: <Package className="h-6 w-6" />,
      category: "Core Features",
      readTime: "15 min read",
      difficulty: "Beginner",
      href: "/guides/item-tracking",
      highlights: [
        "Moving items between stages",
        "Bulk operations and quantity management",
        "Rework processes and quality control",
        "Item history and timeline tracking",
      ],
    },
    {
      id: "team-permissions",
      title: "Team Management & Permissions",
      description:
        "Configure your team access and permissions for optimal security and productivity",
      icon: <Users className="h-6 w-6" />,
      category: "Administration",
      readTime: "10 min read",
      difficulty: "Intermediate",
      href: "/guides/team-permissions",
      highlights: [
        "User roles and responsibilities",
        "Granular permission settings",
        "Access control best practices",
        "Team collaboration workflows",
      ],
    },
    {
      id: "reporting-analytics",
      title: "Reporting & Analytics",
      description:
        "Generate insights and track performance with Trakure's reporting features",
      icon: <TrendingUp className="h-6 w-6" />,
      category: "Analytics",
      readTime: "8 min read",
      difficulty: "Intermediate",
      href: "/guides/reporting",
      highlights: [
        "Dashboard metrics and KPIs",
        "Export reports and data",
        "Bottleneck identification",
        "Performance monitoring",
      ],
    },
    {
      id: "getting-started",
      title: "Quick Start Guide",
      description: "Get up and running with Trakure in your first week",
      icon: <FileText className="h-6 w-6" />,
      category: "Getting Started",
      readTime: "5 min read",
      difficulty: "Beginner",
      href: "/guides/quick-start",
      highlights: [
        "Day-by-day setup timeline",
        "Essential first steps",
        "Common mistakes to avoid",
        "Success milestones",
      ],
    },
  ];

  const categories = Array.from(new Set(guides.map((guide) => guide.category)));

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-100 text-green-800 border-green-200";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Advanced":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header Section */}
          <div className="px-4 lg:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Guides & Documentation
                    </h1>
                    <p className="text-muted-foreground">
                      Learn how to get the most out of Trakure for your export
                      manufacturing business
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="px-4 lg:px-6">
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  New to Trakure?
                </CardTitle>
                <CardDescription>
                  Start with our comprehensive guide to understand how Trakure
                  can transform your export manufacturing workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-primary text-white">
                  <Link href="/guides/comprehensive">
                    Read the Complete User Guide
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Guides Grid */}
          <div className="px-4 lg:px-6">
            <div className="space-y-8">
              {categories.map((category) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {category}
                    </h2>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {guides
                      .filter((guide) => guide.category === category)
                      .map((guide) => (
                        <Card
                          key={guide.id}
                          className="group hover:shadow-md transition-all duration-200 hover:border-primary/30"
                        >
                          <CardHeader className="pb-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                  {guide.icon}
                                </div>
                                <div className="space-y-1">
                                  <CardTitle className="text-lg leading-none">
                                    {guide.title}
                                  </CardTitle>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{guide.readTime}</span>
                                    <span>•</span>
                                    <Badge
                                      variant="outline"
                                      className={getDifficultyColor(
                                        guide.difficulty
                                      )}
                                    >
                                      {guide.difficulty}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            <CardDescription className="text-sm leading-relaxed">
                              {guide.description}
                            </CardDescription>

                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-foreground">
                                What you'll learn:
                              </h4>
                              <ul className="space-y-1">
                                {guide.highlights.map((highlight, index) => (
                                  <li
                                    key={index}
                                    className="text-xs text-muted-foreground flex items-start gap-2"
                                  >
                                    <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                                    {highlight}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <Button
                              variant="outline"
                              className="w-full group-hover:bg-primary group-hover:text-white transition-colors"
                              asChild
                            >
                              <Link href={guide.href}>
                                Read Guide
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Help Section */}
          <div className="px-4 lg:px-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Need More Help?</CardTitle>
                <CardDescription>
                  Can't find what you're looking for? We're here to help you
                  succeed with Trakure.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
                <Button variant="outline" asChild>
                  <Link href="/settings/account">Contact Support</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings/organization">Request Feature</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
