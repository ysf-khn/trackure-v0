import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { AnimatedButton } from "@/components/ui/animated-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex flex-col min-h-screen bg-black text-white w-full">
      <div className="p-6">
        <AnimatedButton>Export Workflows, Perfected</AnimatedButton>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full">
        <div className="flex flex-col items-center mb-8 w-full">
          <AnimatedLogo />
          <h1 className="text-3xl font-bold mb-2">Welcome back to Trackure</h1>
          <p className="text-sm text-gray-400">
            First time here?{" "}
            <Link className="text-gray-300 hover:underline" href="/sign-up">
              Sign up for free.
            </Link>
          </p>
        </div>

        <form className="w-full max-w-md flex flex-col gap-5">
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
              className="bg-gray-900 border-gray-800 h-12 rounded-md"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-gray-400">
              Password
            </Label>
            <Input
              name="password"
              id="password"
              type="password"
              placeholder="Enter your password"
              required
              className="bg-gray-900 border-gray-800 h-12 rounded-md"
            />
          </div>

          <Button
            type="submit"
            className="bg-gray-100 text-black hover:bg-white h-12 rounded-md"
            formAction={signInAction}
          >
            Sign in
          </Button>
        </form>

        <div className="flex items-center gap-4 my-2 w-full max-w-md">
          <div className="h-px bg-gray-800 flex-1"></div>
          <span className="text-sm text-gray-500">or</span>
          <div className="h-px bg-gray-800 flex-1"></div>
        </div>

        <GoogleSignInButton />

        <Link
          href="/forgot-password"
          className="text-sm text-white hover:underline text-center mt-4"
        >
          Forgot your password?
        </Link>

        <FormMessage message={searchParams} />

        <p className="text-xs text-gray-500 text-center mt-4">
          You acknowledge that you read, and agree to our{" "}
          <Link href="#" className="text-gray-400 hover:underline">
            Terms of Service
          </Link>{" "}
          and our{" "}
          <Link href="#" className="text-gray-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
