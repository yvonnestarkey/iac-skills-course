import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { onboardingSkipCookieClear } from "@/lib/onboarding-session";

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const base = {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith("sb-") || /supabase/i.test(cookie.name)) {
      response.cookies.set({ ...base, name: cookie.name, value: "" });
    }
  });
  response.cookies.set(onboardingSkipCookieClear());
}

/** Clear the HttpOnly Supabase session so the next /student visit is a login. */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.json({ ok: true });
  if (!url || !anonKey) {
    clearAuthCookies(request, response);
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.signOut();
  clearAuthCookies(request, response);
  return response;
}
