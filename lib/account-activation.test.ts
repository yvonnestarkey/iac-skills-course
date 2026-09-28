import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  accountActivationLabel,
  accountActivationStatus,
  canSendPasswordSetupLink,
  recentlySentRecovery,
} from "./account-activation";
import { sendExistingUserPasswordSetup, shouldCreateAuthUserForPasswordSetup } from "./account-recovery";

test("expired invitation offers recovery instead of a dead end", () => {
  const page = readFileSync(resolve("app/auth/update-password/page.tsx"), "utf8");
  assert.match(page, /Send me a new link/);
  assert.match(page, /Student login/);
  assert.match(page, /Forgot password/);
  assert.doesNotMatch(page, /Email me at yvonne@accountingstudyadvice.com for help/);
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
