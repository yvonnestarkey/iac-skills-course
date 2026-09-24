import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTO_SEND_WAITLIST_ON_DEPLOY, wouldSendInvitationsOnDeploy } from "./coach-invites";
import {
  afterPasswordSavedPath,
  canSubmitInvitePassword,
  establishAuthSession,
  expiredInviteMessage,
  isInvitePasswordFlow,
  parseInviteAuthParams,
  shouldShowRawAuthError,
  studentFacingPasswordError,
} from "./invite-session";
import { firstNameFromFullName, inviteGreeting, inviteLogoUrl, inviteUserMetadata, INVITE_EMAIL_SUBJECT, INVITE_SENDER_EMAIL } from "./invite-email";

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
  assert.match(studentFacingPasswordError({ message: "otp_expired" }, true), /expired or has already been used/i);
  assert.match(studentFacingPasswordError({ message: "Auth session missing!" }, true), /still opening/i);
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

test("establishAuthSession waits for getSession before treating the invite as ready", async () => {
  let session: { user: { id: string } } | null = null;
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      exchangeCodeForSession: async () => {
        throw new Error("should wait for existing session first");
      },
      verifyOtp: async () => ({ error: null }),
      setSession: async () => {
        session = { user: { id: "u1" } };
        return { error: null };
      },
    },
  };
  const pending = await establishAuthSession(client, parseInviteAuthParams("type=invite", ""));
  assert.equal(pending.ok, false);
  const recovered = await establishAuthSession(
    client,
    parseInviteAuthParams("type=invite", "#access_token=tok&refresh_token=ref")
  );
  assert.equal(recovered.ok, true);
});

test("used or invalid invite tokens become an expired state rather than a password retry loop", async () => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      exchangeCodeForSession: async () => ({ error: { message: "otp_expired" } }),
      verifyOtp: async () => ({ error: { message: "otp_expired" } }),
      setSession: async () => ({ error: { message: "invalid claim" } }),
    },
  };
  const result = await establishAuthSession(
    client,
    parseInviteAuthParams("type=invite", "#access_token=old&refresh_token=old")
  );
  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("password page stays disabled until the invite session is ready", () => {
  const page = readFileSync(resolve("app/auth/update-password/page.tsx"), "utf8");
  assert.match(page, /establishAuthSession/);
  assert.match(page, /Opening your invitation/);
  assert.match(page, /canSubmitInvitePassword/);
  assert.match(page, /studentFacingPasswordError/);
  assert.match(page, /afterPasswordSavedPath/);
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
  assert.match(html, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(html, /asa-logo\.png/);
  assert.match(html, /yvonne@accountingstudyadvice\.com/);
  assert.match(html, /US\$32\.70/);
  assert.equal(readFileSync(resolve("supabase/auth-email-setup.txt"), "utf8").includes("SMTP password"), true);
});
