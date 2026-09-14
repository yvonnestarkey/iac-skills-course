"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { onboardingSkipCookieSet } from "@/lib/onboarding-session";

/** Skip onboarding for this browser session only, then open the course. */
export async function skipOnboardingForSession() {
  const jar = await cookies();
  const skip = onboardingSkipCookieSet();
  jar.set({
    name: skip.name,
    value: skip.value,
    httpOnly: skip.httpOnly,
    path: skip.path,
    sameSite: skip.sameSite,
    secure: skip.secure,
  });
  redirect("/student/overview");
}
