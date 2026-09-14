export const ONBOARDING_SKIP_COOKIE = "onboarding_skipped_session";

const cookieBase = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Session cookie: no maxAge/expires, so it dies when the browser session ends. */
export function onboardingSkipCookieSet() {
  return {
    ...cookieBase,
    name: ONBOARDING_SKIP_COOKIE,
    value: "true",
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
