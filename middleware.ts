import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ONBOARDING_SKIP_COOKIE, onboardingSkipCookieClear } from "@/lib/onboarding-session";
import { isCoachAccount } from "@/lib/roles";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

function isStudentAppPath(pathname: string): boolean {
  return pathname === "/student" || pathname.startsWith("/student/");
}

/**
 * Cookie session + onboarding gate. Incomplete students cannot open `/student/*`
 * unless this browser session set `onboarding_skipped_session`.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });

  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/student/login" || pathname === "/login" || pathname === "/register";
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isCoachPath = pathname === "/coach" || pathname.startsWith("/coach/");
  const isCommercePath = pathname === "/welcome" || pathname.startsWith("/checkout");
  const staff = Boolean(user && isCoachAccount(user));

  if (pathname.startsWith("/auth/callback")) return response;

  if (isLogin) {
    response.cookies.set(onboardingSkipCookieClear());
    return response;
  }

  if ((isStudentAppPath(pathname) || isOnboarding || isCommercePath || isCoachPath) && !user) {
    const login = new URL("/login", request.url);
    if (isStudentAppPath(pathname) && pathname !== "/student") {
      login.searchParams.set("next", pathname);
    }
    return copyCookies(response, NextResponse.redirect(login));
  }

  if (isCoachPath) {
    if (!staff) return copyCookies(response, NextResponse.redirect(new URL("/student", request.url)));
    return response;
  }

  if (!isStudentAppPath(pathname) || !user) return response;

  if (staff) {
    return response;
  }

  if (request.cookies.get(ONBOARDING_SKIP_COOKIE)?.value === "true") return response;

  const { data: profile, error } = await supabase
    .from("student_profiles")
    .select("onboarding_completed, onboarding_skipped")
    .eq("student_id", user.id)
    .maybeSingle();

  // After idle, JWT refresh can make this query fail. Do not bounce students
  // who already passed the gate just because the profile row could not be read.
  if (error) return response;

  if (profile?.onboarding_completed === true || profile?.onboarding_skipped === true) return response;

  const redirect = NextResponse.redirect(new URL("/onboarding", request.url));
  return copyCookies(response, redirect);
}

export const config = {
  matcher: ["/student", "/student/:path*", "/onboarding", "/onboarding/:path*", "/coach", "/coach/:path*", "/login", "/register", "/welcome", "/checkout", "/checkout/:path*", "/auth/:path*"],
};
