import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  accountActivationLabel,
  accountActivationStatus,
  canSendPasswordSetupLink,
  coachActivationPublicRow,
  recentlySentRecovery,
} from "./account-activation";
import { sendExistingUserPasswordSetup, shouldCreateAuthUserForPasswordSetup } from "./account-recovery";

test("expired invitation offers recovery instead of a dead end", () => {
  const page = readFileSync(resolve("app/auth/update-password/page.tsx"), "utf8");
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  assert.match(page, /expiredInviteHeading/);
  assert.match(page, /expiredInviteRecoveryCta/);
  assert.match(page, /Student Login/);
  assert.match(page, /alreadyActivatedPrompt/);
  assert.match(page, /freshLinkSentHeading/);
  assert.match(page, /Still having trouble\? Email Yvonne at/);
  assert.match(page, /Set your password/);
  assert.doesNotMatch(page, /This invitation link has expired or has already been used/);
  assert.doesNotMatch(page, /Email me at yvonne@accountingstudyadvice.com for help/);
  assert.match(css, /invite-setup/);
  assert.match(css, /invite-recovery-form/);
});

test("already-consumed invitation recovers the existing user and does not create another", async () => {
  assert.equal(shouldCreateAuthUserForPasswordSetup(), false);
  const created: string[] = [];
  const result = await sendExistingUserPasswordSetup("student@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => ({
      user_id: "student-1",
      email: "student@example.com",
      invited_at: "2026-09-01T00:00:00.000Z",
      email_confirmed_at: "2026-09-01T00:05:00.000Z",
      last_sign_in_at: "2026-09-01T00:05:00.000Z",
      has_password: false,
    }),
    confirmEmail: async () => undefined,
    sendRecoveryEmail: async () => ({ error: null }),
  });
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(result.emailed, true);
  assert.equal(created.length, 0);
  assert.equal(accountActivationStatus({ user_id: "student-1", invited_at: "x", has_password: false }), "needs_activation");
});

test("activated student is labelled as able to sign in, not as needing another entitlement", () => {
  const status = accountActivationStatus({
    user_id: "student-1",
    has_password: true,
    email_confirmed_at: "2026-09-01T00:00:00.000Z",
    last_sign_in_at: "2026-09-10T00:00:00.000Z",
  });
  assert.equal(status, "activated");
  assert.equal(accountActivationLabel(status), "Can sign in");
  assert.equal(canSendPasswordSetupLink(status), false);
});

test("invited student with no password needs activation", () => {
  const status = accountActivationStatus({
    user_id: "student-1",
    invited_at: "2026-09-01T00:00:00.000Z",
    has_password: false,
  });
  assert.equal(status, "needs_activation");
  assert.equal(accountActivationLabel(status), "Needs activation");
  assert.equal(canSendPasswordSetupLink(status), true);
});

test("invited student who later set a password can sign in", () => {
  const status = accountActivationStatus({
    user_id: "student-1",
    invited_at: "2026-09-01T00:00:00.000Z",
    email_confirmed_at: "2026-09-01T00:05:00.000Z",
    last_sign_in_at: "2026-09-10T00:00:00.000Z",
    has_password: true,
  });
  assert.equal(status, "activated");
  assert.equal(accountActivationLabel(status), "Can sign in");
});

test("password plus onboarding completed still classifies from has_password only", () => {
  assert.equal(accountActivationStatus({ has_password: true }), "activated");
  assert.equal(accountActivationStatus({ has_password: false }), "needs_activation");
});

test("password plus onboarding skipped or pending can still sign in", () => {
  assert.equal(accountActivationStatus({ has_password: true }), "activated");
  assert.equal(canSendPasswordSetupLink("activated"), false);
});

test("no password plus onboarding completed via invite session still needs activation", () => {
  const status = accountActivationStatus({
    user_id: "student-1",
    invited_at: "2026-09-01T00:00:00.000Z",
    email_confirmed_at: "2026-09-01T00:05:00.000Z",
    last_sign_in_at: "2026-09-01T00:05:00.000Z",
    has_password: false,
  });
  assert.equal(status, "needs_activation");
});

test("unavailable has_password never falsely reports Needs activation", () => {
  const invitedUnknown = accountActivationStatus({
    user_id: "student-1",
    invited_at: "2026-09-01T00:00:00.000Z",
    email_confirmed_at: "2026-09-01T00:05:00.000Z",
    last_sign_in_at: "2026-09-10T00:00:00.000Z",
  });
  assert.equal(invitedUnknown, "unavailable");
  assert.equal(accountActivationStatus({ user_id: "student-1" }), "unavailable");
  assert.equal(accountActivationStatus({ has_password: null }), "unavailable");
  assert.equal(accountActivationLabel("unavailable"), "Activation status unavailable");
  assert.equal(accountActivationLabel(undefined), "Activation status unavailable");
  assert.equal(canSendPasswordSetupLink("unavailable"), false);
  assert.equal(canSendPasswordSetupLink(undefined), false);
  const badge = readFileSync(resolve("components/coach/AccountActivationBadge.tsx"), "utf8");
  assert.doesNotMatch(badge, /status === "activated" \? "activated" : "needs_activation"/);
});

test("coach activation API stays staff-gated and never returns Auth credentials", () => {
  const route = readFileSync(resolve("app/api/coach/account-activation/route.ts"), "utf8");
  assert.match(route, /isStaffUser/);
  assert.match(route, /status: 403/);
  assert.match(route, /coachActivationPublicRow/);
  assert.doesNotMatch(route, /\.\.\.snapshot/);
  assert.doesNotMatch(route, /encrypted_password/);
  const row = coachActivationPublicRow({
    user_id: "student-1",
    email: "preview@example.com",
    invited_at: "2026-09-01T00:00:00.000Z",
    has_password: true,
  });
  assert.deepEqual(Object.keys(row).sort(), ["activation_status", "has_password", "user_id"]);
  assert.equal(row.has_password, true);
  assert.equal(row.activation_status, "activated");
  assert.equal("encrypted_password" in row, false);
  assert.equal("invited_at" in row, false);
  const sql = readFileSync(resolve("supabase/student-account-activation.sql"), "utf8");
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(sql, /is_course_staff\(\)/);
  assert.match(sql, /grant execute on function public\.list_student_account_activation\(\) to service_role/);
  assert.match(sql, /as has_password/);
  assert.doesNotMatch(sql, /returns table \([^)]*encrypted_password/i);
});

test("resend/recovery uses the existing account and preserves entitlement", async () => {
  let confirmed = 0;
  let recoveries = 0;
  let grants = 0;
  const result = await sendExistingUserPasswordSetup("preview@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => ({
      user_id: "student-1",
      email: "preview@example.com",
      invited_at: "2026-09-20T00:00:00.000Z",
      email_confirmed_at: null,
      has_password: false,
    }),
    confirmEmail: async () => {
      confirmed += 1;
    },
    sendRecoveryEmail: async (email, redirectTo) => {
      recoveries += 1;
      assert.equal(email, "preview@example.com");
      assert.match(redirectTo, /\/auth\/update-password\?type=recovery/);
      return { error: null };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(confirmed, 1);
  assert.equal(recoveries, 1);
  assert.equal(grants, 0);
});

test("repeated resend does not create a duplicate user or extra entitlement", async () => {
  let recoveries = 0;
  const deps = {
    siteUrl: "https://iac.accountingstudyadvice.com",
    now: new Date("2026-09-28T12:00:00.000Z"),
    findUser: async () => ({
      user_id: "student-1",
      email: "preview@example.com",
      invited_at: "2026-09-20T00:00:00.000Z",
      has_password: false,
      recovery_sent_at: "2026-09-28T11:59:30.000Z",
    }),
    confirmEmail: async () => undefined,
    sendRecoveryEmail: async () => {
      recoveries += 1;
      return { error: null };
    },
  };
  const first = await sendExistingUserPasswordSetup("preview@example.com", deps);
  const second = await sendExistingUserPasswordSetup("preview@example.com", deps);
  assert.equal(first.reason, "recently_sent");
  assert.equal(second.reason, "recently_sent");
  assert.equal(first.created_user, false);
  assert.equal(second.created_user, false);
  assert.equal(recoveries, 0);
  assert.equal(recentlySentRecovery("2026-09-28T11:59:30.000Z", new Date("2026-09-28T12:00:00.000Z")), true);
});

test("password setup never invites a second Auth user or changes course access", async () => {
  const result = await sendExistingUserPasswordSetup("missing@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => null,
    confirmEmail: async () => {
      throw new Error("must not confirm a missing user");
    },
    sendRecoveryEmail: async () => {
      throw new Error("must not email a missing user");
    },
  });
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(result.reason, "not_found");
  const sql = readFileSync(resolve("supabase/student-account-activation.sql"), "utf8");
  assert.match(sql, /encrypted_password/);
  assert.doesNotMatch(sql, /course_entitlements|grantFullEntitlement|inviteUserByEmail/);
});
