import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth is a browser session (Supabase persistSession / localStorage).
 * Do not fetch profiles or course payloads here — layouts reuse the cached client session.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/coach/:path*", "/onboarding"],
};
