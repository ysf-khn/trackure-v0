"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full h-11 sm:h-12 border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 hover:border-neutral-500 rounded-md transition-all duration-200 font-medium disabled:opacity-70 disabled:cursor-not-allowed text-base"
      disabled={pending}
    >
      {pending ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing in...
        </div>
      ) : (
        "Sign in"
      )}
    </Button>
  );
};
