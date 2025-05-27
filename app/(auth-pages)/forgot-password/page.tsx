import { forgotPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { AnimatedButton } from "@/components/ui/animated-button";
import { SubmitButton } from "./components";

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex flex-col min-h-screen bg-black text-white w-full">
      <div className="p-6 absolute top-0 left-0">
        <AnimatedButton>Export Workflows, Perfected</AnimatedButton>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full">
        <div className="flex flex-col items-center mb-8 w-full">
          <AnimatedLogo />
          <h1 className="text-3xl font-bold mb-2">Reset your password</h1>
          <p className="text-sm text-gray-400">
            Remember your password?{" "}
            <Link className="text-gray-300 hover:underline" href="/sign-in">
              Sign in instead.
            </Link>
          </p>
        </div>

        <form
          className="w-full max-w-md flex flex-col gap-5"
          action={forgotPasswordAction}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-gray-400">
              Email
            </Label>
            <Input
              name="email"
              id="email"
              type="email"
              placeholder="Your email"
              required
              className="border-gray-800 h-12 rounded-md"
            />
          </div>

          <SubmitButton />
        </form>

        <FormMessage message={searchParams} />

        <p className="text-xs text-gray-500 text-center mt-8">
          You acknowledge that you read, and agree to our{" "}
          <Link
            href="/terms-of-service"
            className="text-gray-400 hover:underline"
          >
            Terms of Service
          </Link>{" "}
          and our{" "}
          <Link
            href="/privacy-policy"
            className="text-gray-400 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
