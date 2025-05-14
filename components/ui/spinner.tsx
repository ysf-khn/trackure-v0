"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils"; // Assuming cn utility exists for class merging

// export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {}
type SpinnerProps = React.SVGAttributes<SVGSVGElement>;

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, ...props }, ref) => {
    return (
      <Loader2 ref={ref} className={cn("animate-spin", className)} {...props} />
    );
  }
);
Spinner.displayName = "Spinner";

export { Spinner };
