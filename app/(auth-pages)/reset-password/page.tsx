import { resetPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { AnimatedButton } from "@/components/ui/animated-button";
import { SubmitButton } from "./components";

export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  const isSuccess = searchParams && "success" in searchParams;

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
            {isSuccess ? (
              <>
                Password updated successfully!{" "}
                <Link className="text-gray-300 hover:underline" href="/sign-in">
                  Sign in now
                </Link>
              </>
            ) : (
              "Enter your new password below"
            )}
          </p>
        </div>

        {!isSuccess && (
          <form
            className="w-full max-w-md flex flex-col gap-5"
            action={resetPasswordAction}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-gray-400">
                New password
              </Label>
              <Input
                name="password"
                id="password"
                type="password"
                placeholder="Enter your new password"
                required
                className="border-gray-800 h-12 rounded-md"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-gray-400">
                Confirm password
              </Label>
              <Input
                name="confirmPassword"
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                required
                className="border-gray-800 h-12 rounded-md"
              />
            </div>

            <SubmitButton />
          </form>
        )}

        <FormMessage message={searchParams} />

        {isSuccess && (
          <div className="w-full max-w-md mt-6">
            <Link
              href="/sign-in"
              className="w-full bg-gray-100 text-black hover:bg-white h-12 rounded-md transition-all duration-200 font-medium flex items-center justify-center"
            >
              Continue to Sign In
            </Link>
          </div>
        )}

        {!isSuccess && (
          <div className="mt-6">
            <Link
              href="/sign-in"
              className="text-sm text-white hover:underline text-center"
            >
              Back to Sign In
            </Link>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center mt-4">
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
