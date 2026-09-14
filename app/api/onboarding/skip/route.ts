import { NextRequest, NextResponse } from "next/server";
import { ONBOARDING_SKIP_COOKIE, onboardingSkipCookieClear } from "@/lib/onboarding-session";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    skipped: request.cookies.get(ONBOARDING_SKIP_COOKIE)?.value === "true",
  });
}

/** Drop the session skip cookie so the next sign-in hits the onboarding guard. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(onboardingSkipCookieClear());
  return response;
}
