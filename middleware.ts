import { NextResponse, type NextRequest } from "next/server";

const ONBOARDING_SKIP_COOKIE = "onboarding_skipped_session";

/**
 * Auth lives in the browser, so this file does not fetch profiles.
 * Visiting sign-in drops the session skip cookie. The student layout then
 * requires `onboarding_completed` unless a new skip is set during this session.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/student/login") {
    const response = NextResponse.next();
    response.cookies.delete(ONBOARDING_SKIP_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/coach/:path*", "/onboarding"],
};
