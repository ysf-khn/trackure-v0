"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

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
          Updating password...
        </div>
      ) : (
        "Update password"
      )}
    </Button>
  );
};
