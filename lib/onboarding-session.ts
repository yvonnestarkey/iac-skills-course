export const ONBOARDING_SKIP_COOKIE = "onboarding_skipped_session";

const cookieBase = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Skip survives tab sleep/discard; login still clears it for the next sign-in. */
export function onboardingSkipCookieSet() {
  return {
    ...cookieBase,
    name: ONBOARDING_SKIP_COOKIE,
    value: "true",
    maxAge: 60 * 60 * 12,
  };
}

export function onboardingSkipCookieClear() {
  return {
    ...cookieBase,
    name: ONBOARDING_SKIP_COOKIE,
    value: "",
    maxAge: 0,
  };
}
