import { NextResponse } from "next/server";
import { onboardingSkipCookieClear } from "@/lib/onboarding-session";

/** Drop the session skip cookie so the next sign-in hits the onboarding guard. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(onboardingSkipCookieClear());
  return response;
}
