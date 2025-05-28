import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import Link from "next/link";
import { AnimatedButton } from "@/components/ui/animated-button";
import { GoogleSignUpButton } from "@/components/auth/google-sign-up-button";
import { SubmitButton, SuccessCheckmark } from "./components";

export default async function Signup(props: {
  searchParams: Promise<
    Message & { productId?: string; success?: boolean; email?: string }
  >;
}) {
  const searchParams = await props.searchParams;

  // Show success message if signup was successful
  if (searchParams.success) {
    return (
      <div className="flex flex-col min-h-screen bg-black text-white w-full">
        {/* Hide on mobile (sm and below), show on larger screens */}
        <div className="p-6 absolute top-0 left-0 hidden md:block">
          <AnimatedButton>Export Workflows, Perfected</AnimatedButton>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full py-8 sm:py-0">
          <div className="flex flex-col items-center mb-6 sm:mb-8 w-full">
            <SuccessCheckmark />
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center">
              Check your email
            </h1>
            <p className="text-gray-400 text-center max-w-md px-4 leading-relaxed">
              We've sent you a verification link. Please check your email and
              click the link to verify your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  const productId = searchParams.productId;
  const prefilledEmail = searchParams.email;

  return (
    <div className="flex flex-col min-h-screen bg-black text-white w-full">
      {/* Hide on mobile (sm and below), show on larger screens */}
      <div className="p-6 absolute top-0 left-0 hidden md:block">
        <AnimatedButton>Export Workflows, Perfected</AnimatedButton>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full py-8 sm:py-0">
        <div className="flex flex-col items-center mb-6 sm:mb-8 w-full">
          <AnimatedLogo />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">
            Get started with Trakure
          </h1>
          <p className="text-sm text-gray-400 text-center">
            Already have an account?{" "}
            <Link className="text-gray-300 hover:underline" href="/sign-in">
              Sign in
            </Link>
          </p>
          {prefilledEmail && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-blue-950/20 border border-blue-500/20 mx-4">
              <p className="text-sm text-blue-300 text-center">
                Creating account for{" "}
                <span className="font-medium">{prefilledEmail}</span>
              </p>
            </div>
          )}
        </div>

        <form
          className="w-full max-w-md flex flex-col gap-4 sm:gap-5"
          action={signUpAction}
        >
          <input type="hidden" name="productId" value={productId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-gray-400">
              Email
            </Label>
            <Input
              name="email"
              id="email"
              type="email"
              placeholder="Your email"
              defaultValue={prefilledEmail}
              required
              className="border-gray-800 h-11 sm:h-12 rounded-md text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-gray-400">
              Password
            </Label>
            <Input
              type="password"
              name="password"
              id="password"
              placeholder="Create a password"
              minLength={6}
              required
              className="border-gray-800 h-11 sm:h-12 rounded-md text-base"
            />
          </div>

          <SubmitButton />
        </form>

        <FormMessage message={searchParams} />

        <div className="flex items-center gap-4 my-4 sm:my-2 w-full max-w-md">
          <div className="h-px bg-gray-800 flex-1"></div>
          <span className="text-sm text-gray-500">or</span>
          <div className="h-px bg-gray-800 flex-1"></div>
        </div>

        <GoogleSignUpButton />

        <p className="text-xs text-gray-500 text-center mt-4 px-4 leading-relaxed">
          By creating an account, you agree to our{" "}
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
