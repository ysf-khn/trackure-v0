"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface AnimatedButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedButton({ children, className }: AnimatedButtonProps) {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition((prev) => (prev + 1) % 4);
    }, 2000); // Change position every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const shadowPositions = {
    0: "shadow-[5px_-5px_30px_rgba(255,255,255,0.1)]", // top left
    1: "shadow-[-5px_-5px_30px_rgba(255,255,255,0.1)]", // top right
    2: "shadow-[-5px_5px_30px_rgba(255,255,255,0.1)]", // bottom right
    3: "shadow-[5px_5px_30px_rgba(255,255,255,0.1)]", // bottom left
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "text-white border-gray-700 bg-transparent transition-shadow duration-1000",
        shadowPositions[position as keyof typeof shadowPositions],
        className
      )}
    >
      {children}
    </Button>
  );
}
