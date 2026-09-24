import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTO_SEND_WAITLIST_ON_DEPLOY, wouldSendInvitationsOnDeploy } from "./coach-invites";
import {
  afterPasswordSavedPath,
  canSubmitInvitePassword,
  consumeAuthParamsFromLocation,
  establishAuthSession,
  expiredInviteMessage,
  isAuthPasswordPath,
  isInvitePasswordFlow,
  isRecoveryPasswordFlow,
  openingPasswordSessionCopy,
  otpTypeFromParams,
  parseInviteAuthParams,
  passwordResetRedirectUrl,
  savePasswordWithSession,
  shouldShowRawAuthError,
  studentFacingPasswordError,
} from "./invite-session";
import { firstNameFromFullName, inviteGreeting, inviteLogoUrl, inviteUserMetadata, INVITE_EMAIL_SUBJECT, INVITE_SENDER_EMAIL } from "./invite-email";

function authClient() {
  let user: { id: string } | null = null;
  return {
    user: () => user,
    setUser: (next: { id: string } | null) => {
      user = next;
    },
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      getUser: async () => ({ data: { user }, error: null }),
      exchangeCodeForSession: async (_code: string) => ({ error: null }),
      verifyOtp: async (_args: { token_hash: string; type: string }) => ({ error: null }),
      setSession: async () => {
        user = { id: "u1" };
        return { error: null };
      },
      updateUser: async (_values: { password: string }) => ({ error: null }),
    },
  };
}

test("deployment sends zero invitations", () => {
  assert.equal(AUTO_SEND_WAITLIST_ON_DEPLOY, false);
  assert.equal(wouldSendInvitationsOnDeploy(), false);
});

test("invite route waits for valid Auth session before enabling password submission", () => {
  assert.equal(canSubmitInvitePassword({ sessionReady: false, invalid: false, submitting: false }), false);
  assert.equal(canSubmitInvitePassword({ sessionReady: true, invalid: false, submitting: false }), true);
  assert.equal(canSubmitInvitePassword({ sessionReady: true, invalid: true, submitting: false }), false);
});

test("one submission is sufficient and a double click cannot start a second update", () => {
  assert.equal(canSubmitInvitePassword({ sessionReady: true, invalid: false, submitting: true }), false);
});

test("friendly handling of invalid or expired invite state", () => {
  assert.match(expiredInviteMessage(), /expired or has already been used/i);
  assert.match(expiredInviteMessage(), /yvonne@accountingstudyadvice.com/i);
  assert.match(studentFacingPasswordError({ message: "otp_expired" }, true), /expired or has already been used/i);
  assert.match(studentFacingPasswordError({ message: "Auth session missing!" }, true), /still opening/i);
  assert.match(studentFacingPasswordError({ message: "Auth session missing!" }, false), /password-reset link/i);
  assert.match(studentFacingPasswordError({ message: "Password update requires reauthentication" }, false), /password-reset link/i);
  assert.match(studentFacingPasswordError({ message: "unable to process request" }, true), /yvonne@accountingstudyadvice.com/i);
  assert.equal(shouldShowRawAuthError(), false);
  assert.equal(studentFacingPasswordError({ message: "AuthApiError: Auth session missing!" }, true).includes("AuthApiError"), false);
  assert.equal(studentFacingPasswordError({ message: "Auth session missing!" }, true).includes("Auth session missing"), false);
});

test("onboarding redirect remains correct after an invite password is saved", () => {
  assert.equal(afterPasswordSavedPath(true), "/onboarding");
  assert.equal(afterPasswordSavedPath(false), null);
  const params = parseInviteAuthParams("type=invite", "#access_token=aaa&refresh_token=bbb&type=invite");
  assert.equal(isInvitePasswordFlow(params), true);
  assert.equal(params.accessToken, "aaa");
});

test("recovery links are parsed separately from invitations", () => {
  const params = parseInviteAuthParams("type=recovery&code=abc", "");
  assert.equal(isRecoveryPasswordFlow(params), true);
  assert.equal(isInvitePasswordFlow(params), false);
  assert.equal(otpTypeFromParams(params), "recovery");
  assert.equal(passwordResetRedirectUrl("https://iac.accountingstudyadvice.com"), "https://iac.accountingstudyadvice.com/auth/update-password?type=recovery");
  assert.equal(isAuthPasswordPath("/auth/update-password"), true);
  assert.equal(isAuthPasswordPath("/auth/callback"), true);
  assert.equal(isAuthPasswordPath("/student"), false);
  assert.equal(openingPasswordSessionCopy(false), "Opening your password reset…");
});

test("auth codes are removed from the URL before the browser client starts", () => {
  const consumed = consumeAuthParamsFromLocation({
    search: "?type=recovery&code=pkce-code",
    hash: "#access_token=tok&refresh_token=ref",
  });
  assert.equal(consumed.params.code, "pkce-code");
  assert.equal(consumed.params.accessToken, "tok");
  assert.equal(consumed.nextSearch, "?type=recovery");
});

test("invitation password setup exchanges invite tokens even if another session already exists", async () => {
  let exchanged = false;
  let current: { id: string } | null = { id: "coach" };
  const client = authClient();
  client.auth.getUser = async () => ({ data: { user: current }, error: null });
  client.auth.exchangeCodeForSession = async (code: string) => {
    exchanged = code === "invite-code";
    current = { id: "student" };
    return { error: null };
  };
  const result = await establishAuthSession(client, parseInviteAuthParams("type=invite&code=invite-code", ""));
  assert.equal(result.ok, true);
  assert.equal(exchanged, true);
});

test("recovery password reset verifies a recovery OTP and can save a password", async () => {
  let otpType: string | null = null;
  let saved: string | null = null;
  const client = authClient();
  client.setUser(null);
  client.auth.verifyOtp = async (args: { token_hash: string; type: string }) => {
    otpType = args.type;
    if (args.token_hash === "recov" && args.type === "recovery") client.setUser({ id: "student" });
    return { error: null };
  };
  client.auth.updateUser = async (values: { password: string }) => {
    saved = values.password;
    return { error: null };
  };
  const established = await establishAuthSession(
    client,
    parseInviteAuthParams("type=recovery&token_hash=recov", "")
  );
  assert.equal(established.ok, true);
  assert.equal(otpType, "recovery");
  const savedResult = await savePasswordWithSession(client, "new-pass-123");
  assert.equal(savedResult.error, null);
  assert.equal(saved, "new-pass-123");
});

test("establishAuthSession does not treat a missing recovery session as ready", async () => {
  const client = authClient();
  const pending = await establishAuthSession(client, parseInviteAuthParams("type=recovery", ""));
  assert.deepEqual(pending, { ok: false, reason: "missing" });
  const recovered = await establishAuthSession(
    client,
    parseInviteAuthParams("type=invite", "#access_token=tok&refresh_token=ref")
  );
  assert.equal(recovered.ok, true);
});

test("used or invalid invite tokens become an expired state rather than a password retry loop", async () => {
  const client = authClient();
  client.auth.getUser = async () => ({ data: { user: null }, error: null });
  client.auth.exchangeCodeForSession = async () => ({ error: { message: "otp_expired" } });
  client.auth.verifyOtp = async () => ({ error: { message: "otp_expired" } });
  client.auth.setSession = async () => ({ error: { message: "invalid claim" } });
  const result = await establishAuthSession(
    client,
    parseInviteAuthParams("type=invite", "#access_token=old&refresh_token=old")
  );
  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("password save refuses to call updateUser without an authenticated session", async () => {
  const client = authClient();
  client.auth.getUser = async () => ({ data: { user: null }, error: null });
  client.auth.updateUser = async () => {
    throw new Error("updateUser must not run without a session");
  };
  const result = await savePasswordWithSession(client, "secret1");
  assert.equal(result.error?.code, "session_missing");
});

test("password page stays disabled until the invite session is ready", () => {
  const page = readFileSync(resolve("app/auth/update-password/page.tsx"), "utf8");
  assert.match(page, /establishAuthSession/);
  assert.match(page, /consumeAuthParamsFromLocation/);
  assert.match(page, /savePasswordWithSession/);
  assert.match(page, /openingPasswordSessionCopy/);
  assert.match(page, /canSubmitInvitePassword/);
  assert.match(page, /studentFacingPasswordError/);
  assert.match(page, /afterPasswordSavedPath/);
  const login = readFileSync(resolve("components/student/StudentLoginForm.tsx"), "utf8");
  assert.match(login, /passwordResetRedirectUrl/);
  assert.equal(login.includes("/auth/callback?next=/auth/update-password"), false);
  const middleware = readFileSync(resolve("middleware.ts"), "utf8");
  assert.match(middleware, /isAuthPasswordPath/);
});

test("invite branding uses the live site logo and Yvonne's existing contact address", () => {
  assert.equal(INVITE_EMAIL_SUBJECT, "Your January 2027 IAC Course preview is ready");
  assert.equal(INVITE_SENDER_EMAIL, "yvonne@accountingstudyadvice.com");
  assert.equal(inviteLogoUrl("https://iac.accountingstudyadvice.com"), "https://iac.accountingstudyadvice.com/asa-logo.png");
  assert.equal(inviteGreeting(firstNameFromFullName("Wait List")), "Hi Wait,");
  assert.equal(inviteGreeting(null), "Hi there,");
  assert.deepEqual(inviteUserMetadata("Thandi Moyo"), { full_name: "Thandi Moyo", first_name: "Thandi" });
  const html = readFileSync(resolve("supabase/invite-user-email.html"), "utf8");
  assert.match(html, /Activate my free preview/);
  assert.match(html, /https:\/\/iac\.accountingstudyadvice\.com\/asa-logo\.png/);
  assert.match(html, /width="120"/);
  assert.match(html, /Hi there,/);
  assert.match(html, /\{\{ \.ConfirmationURL \}\}/);
  assert.equal(/\{\{\s*if/i.test(html), false);
  assert.equal(/\.Data\./.test(html), false);
  assert.equal((html.match(/\{\{/g) || []).length, 1);
  assert.match(html, /yvonne@accountingstudyadvice.com/);
  assert.match(html, /US\$32\.70/);
  assert.equal(readFileSync(resolve("supabase/auth-email-setup.txt"), "utf8").includes("SMTP password"), true);
});
