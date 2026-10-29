import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthPasswordPath } from "@/lib/invite-session";
import {
  classCanonicalStudentPath,
  coursePublicSlug,
  DEFAULT_LMS_COURSE_ID,
  getLmsCourse,
  isLmsClassroomPath,
} from "@/lib/lms-catalog";
import {
  classLmsOrigin,
  iacClassroomUrl,
  iacSalesUrl,
  isClassLmsHost,
  isIacLmsHost,
  isLocalDevHost,
  publicCatalogUrl,
} from "@/lib/lms-hosts";
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

function requestHost(request: NextRequest): string {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
}

/**
 * Cookie session + onboarding gate. Incomplete students cannot open classroom
 * paths unless this browser session set `onboarding_skipped_session`.
 *
 * iac. is IAC-only. Catalog lives on class.accountingstudyadvice.com.
 * Other courses are /<slug> on class. (e.g. /auditrisk). IAC catalog links go to iac.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = requestHost(request);
  const classHost = isClassLmsHost(host);

  if (isIacLmsHost(host) && !isLocalDevHost(host) && (pathname === "/courses" || pathname.startsWith("/courses/"))) {
    if (pathname === `/courses/${DEFAULT_LMS_COURSE_ID}` || pathname.startsWith(`/courses/${DEFAULT_LMS_COURSE_ID}/`)) {
      const toIacClassroom = pathname.includes("/learn");
      return NextResponse.redirect(new URL(toIacClassroom ? iacClassroomUrl() : iacSalesUrl()));
    }
    const parts = pathname.split("/").filter(Boolean);
    const course = getLmsCourse(parts[1]);
    if (!course) return NextResponse.redirect(new URL(publicCatalogUrl()));
    const rest = parts.slice(2);
    const dest = `/${coursePublicSlug(course)}${rest.length ? `/${rest.join("/")}` : ""}`;
    return NextResponse.redirect(new URL(`${classLmsOrigin()}${dest}`));
  }

  if (classHost) {
    const canonical = classCanonicalStudentPath(pathname);
    if (canonical) {
      return NextResponse.redirect(new URL(canonical));
    }
  }

  if (isAuthPasswordPath(pathname)) return NextResponse.next({ request });

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

  const isLogin = pathname === "/student/login" || pathname === "/login" || pathname === "/register";
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isCoachPath = pathname === "/coach" || pathname.startsWith("/coach/");
  const isCommercePath = pathname === "/welcome" || pathname.startsWith("/checkout");
  const isClassroom = isLmsClassroomPath(pathname);
  const staff = Boolean(user && isCoachAccount(user));

  if (isLogin) {
    response.cookies.set(onboardingSkipCookieClear());
    return response;
  }

  if ((isClassroom || isOnboarding || isCommercePath || isCoachPath) && !user) {
    const login = new URL("/login", request.url);
    if (isClassroom && pathname !== "/student" && pathname !== "/iac-skills/learn") {
      login.searchParams.set("next", pathname);
    }
    return copyCookies(response, NextResponse.redirect(login));
  }

  if (isCoachPath) {
    const studentHome = classHost ? iacClassroomUrl() : "/student";
    if (!staff) return copyCookies(response, NextResponse.redirect(new URL(studentHome, request.url)));
    return response;
  }

  if (!isClassroom || !user) return response;

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
  matcher: [
    "/student",
    "/student/:path*",
    "/courses",
    "/courses/:path*",
    "/iac-skills",
    "/iac-skills/:path*",
    "/cta-skills",
    "/cta-skills/:path*",
    "/controls",
    "/controls/:path*",
    "/auditrisk",
    "/auditrisk/:path*",
    "/substantive",
    "/substantive/:path*",
    "/strategy-mindset",
    "/strategy-mindset/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/coach",
    "/coach/:path*",
    "/login",
    "/register",
    "/welcome",
    "/checkout",
    "/checkout/:path*",
    "/auth/:path*",
  ],
};
