import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Define constants outside the function for better memory usage
const ONBOARDING_STEPS = {
  pending_profile: "/profile",
  pending_org: "/organization",
  pending_workflow: "/setup-workflow",
  pending_invites: "/invite",
};

const APP_ROUTES = new Set([
  "/dashboard",
  "/orders",
  "/settings",
  "/workflow",
  "/dashboard",
]);
const ONBOARDING_ROUTES = new Set([
  "/profile",
  "/organization",
  "/setup-workflow",
  "/invite",
]);
const AUTH_ROUTES = new Set(["/login", "/signup", "/sign-in"]);

// Optimized path matching using Sets for O(1) lookup
function isExactPathMatch(pathname: string, routes: Set<string>): boolean {
  return routes.has(pathname);
}

function isPathOrSubpathMatch(pathname: string, routes: Set<string>): boolean {
  if (routes.has(pathname)) return true;
  return Array.from(routes).some((route) => pathname.startsWith(route + "/"));
}

export const updateSession = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  // Early bypasses for performance
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  try {
    // Create response once
    let response = NextResponse.next({
      request: { headers: request.headers },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // This will refresh session if expired
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    const isPublicRoot = pathname === "/";
    const isAuthPath = isPathOrSubpathMatch(pathname, AUTH_ROUTES);

    // --- Handle unauthenticated users ---
    if (getUserError || !user) {
      // If not on an auth route or public root, redirect to sign-in
      if (!isAuthPath && !isPublicRoot) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      return response;
    }

    // --- Handle authenticated users ---

    // Optimize by checking auth routes first (most common redirect case)
    if (isAuthPath) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Public root redirect for authenticated users
    if (isPublicRoot) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Performance optimization: Only query the database if we need the onboarding status
    // This reduces database load significantly
    const isCurrentPathApp = isPathOrSubpathMatch(pathname, APP_ROUTES);
    const isCurrentPathOnboarding = isPathOrSubpathMatch(
      pathname,
      ONBOARDING_ROUTES
    );

    // Skip DB query if the user is on a path that doesn't need onboarding check
    if (!isCurrentPathApp && !isCurrentPathOnboarding) {
      return response;
    }

    // Only now fetch onboarding status since we need it
    let onboardingStatus: string | null = null;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_status")
        .eq("id", user.id)
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          onboardingStatus = "pending_profile";
        } else {
          console.error(
            "[Middleware Error] Error fetching profile:",
            profileError
          );
          return NextResponse.redirect(new URL("/sign-in", request.url));
        }
      } else if (profileData) {
        onboardingStatus = profileData.onboarding_status;
      } else {
        onboardingStatus = "pending_profile"; // Default assumption
      }
    } catch (e) {
      console.error("[Middleware Error] Exception fetching profile:", e);
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    const isOnboardingComplete = onboardingStatus === "complete";
    const expectedOnboardingPath =
      ONBOARDING_STEPS[onboardingStatus as keyof typeof ONBOARDING_STEPS] ||
      null;

    // --- Simplified redirection logic ---

    // Case 1: Onboarding complete
    if (isOnboardingComplete) {
      // Redirect away from onboarding routes to dashboard area
      if (isCurrentPathOnboarding) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      // Allow access to app routes
      return response;
    }

    // Case 2: Onboarding incomplete

    // If trying to access app routes, redirect to correct onboarding step
    if (isCurrentPathApp) {
      const redirectPath = expectedOnboardingPath || "/profile";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // If on wrong onboarding step, redirect to correct one
    if (
      isCurrentPathOnboarding &&
      expectedOnboardingPath &&
      pathname !== expectedOnboardingPath
    ) {
      return NextResponse.redirect(
        new URL(expectedOnboardingPath, request.url)
      );
    }

    // Allow access if on correct onboarding step
    return response;
  } catch (e) {
    console.error("[Middleware Error]", e);
    // Fallback for client creation errors
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }
};
