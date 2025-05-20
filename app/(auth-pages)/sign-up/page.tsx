import { signInWithGoogleAction, signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import Link from "next/link";
import Image from "next/image";
import { SmtpMessage } from "../smtp-message";
import { AnimatedButton } from "@/components/ui/animated-button";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white w-full">
      <div className="p-6">
        <AnimatedButton>Export Workflows, Perfected</AnimatedButton>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full">
        <div className="flex flex-col items-center mb-8 w-full">
          <AnimatedLogo />
          <h1 className="text-3xl font-bold mb-2">Get started with Trakure</h1>
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link className="text-gray-300 hover:underline" href="/sign-in">
              Sign in
            </Link>
          </p>
        </div>

        <form
          className="w-full max-w-md flex flex-col gap-5"
          action={signUpAction}
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
              className="bg-gray-900 border-gray-800 h-12 rounded-md"
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
              className="bg-gray-900 border-gray-800 h-12 rounded-md"
            />
          </div>

          <Button
            type="submit"
            className="bg-gray-100 text-black hover:bg-white h-12 rounded-md"
          >
            Create account
          </Button>

          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-gray-800 flex-1"></div>
            <span className="text-sm text-gray-500">or</span>
            <div className="h-px bg-gray-800 flex-1"></div>
          </div>

          <Button
            type="submit"
            variant="outline"
            className="border border-gray-800 bg-gray-900 text-white h-12 rounded-md flex items-center justify-center gap-2"
            formAction={signInWithGoogleAction}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path
                  fill="#4285F4"
                  d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                />
                <path
                  fill="#34A853"
                  d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                />
                <path
                  fill="#FBBC05"
                  d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                />
                <path
                  fill="#EA4335"
                  d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                />
              </g>
            </svg>
            Sign up with Google
          </Button>

          <FormMessage message={searchParams} />

          <p className="text-xs text-gray-500 text-center mt-4">
            By creating an account, you agree to our{" "}
            <Link href="#" className="text-gray-400 hover:underline">
              Terms of Service
            </Link>{" "}
            and our{" "}
            <Link href="#" className="text-gray-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>
      <SmtpMessage />
    </div>
  );
}
