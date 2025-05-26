"use client";

import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export const SuccessCheckmark = () => (
  <div className="w-12 h-12 rounded-lg bg-black border border-green-500/20 flex items-center justify-center relative mb-6">
    <div className="absolute inset-0 bg-green-500/20 rounded-lg blur-lg"></div>
    <Check className="w-6 h-6 text-green-500" strokeWidth={3} />
  </div>
);

export const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="bg-gray-100 text-black hover:bg-white h-12 rounded-md transition-all duration-200 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
      disabled={pending}
    >
      {pending ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating account...
        </div>
      ) : (
        "Create account"
      )}
    </Button>
  );
};
