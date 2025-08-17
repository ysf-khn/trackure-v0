"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  Clock,
  User,
  Activity,
  MoveRight,
  Undo2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrderActivity } from "@/hooks/queries/use-order-activity";
import type { OrderActivityEvent } from "@/hooks/queries/use-order-activity";

interface OrderTimelineProps {
  orderId: string;
}

const getEventIcon = (type: string, metadata?: any) => {
  switch (type) {
    case "created":
      return Package;
    case "item_added":
      return Plus;
    case "item_updated":
      return Edit;
    case "payment_updated":
      return ArrowRight;
    case "status_changed":
      return Activity;
    case "item_moved":
      return metadata?.rework ? Undo2 : MoveRight;
    default:
      return Clock;
  }
};

const getEventColor = (type: string, metadata?: any) => {
  switch (type) {
    case "created":
      return "text-green-500 bg-green-500/10 border-green-500/20";
    case "item_added":
      return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    case "item_updated":
      return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    case "payment_updated":
      return "text-purple-500 bg-purple-500/10 border-purple-500/20";
    case "status_changed":
      return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
    case "item_moved":
      return metadata?.rework 
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
        : "text-teal-500 bg-teal-500/10 border-teal-500/20";
    default:
      return "text-gray-500 bg-gray-500/10 border-gray-500/20";
  }
};

export function OrderTimeline({ orderId }: OrderTimelineProps) {
  const { data: events, isLoading } = useOrderActivity(orderId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-32 mx-auto mb-2"></div>
              <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => {
            const Icon = getEventIcon(event.type, event.metadata);
            const colorClass = getEventColor(event.type, event.metadata);
            const isLast = index === events.length - 1;

            return (
              <div key={event.id} className="relative flex gap-3">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-5 top-10 w-0.5 h-[calc(100%-2rem)] bg-border/50" />
                )}
                
                {/* Icon */}
                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border ${colorClass} flex-shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-8">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </time>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}