import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { accountActivationStatus, recentlySentRecovery } from "./account-activation";
import {
  ACTIVATE_PATH,
  activateInboxBody,
  activateInboxHeading,
  activatePageBody,
  activatePageCta,
  activatePageHeading,
  loginActivateLinkLabel,
  loginActivatePrompt,
  loginForgotPasswordHint,
  publicActivateUrl,
  publicPasswordSetupCopy,
  sendExistingUserPasswordSetup,
  shouldCreateAuthUserForPasswordSetup,
} from "./account-recovery";

function previewStudent() {
  return {
    user_id: "student-preview",
    email: "preview@example.com",
    invited_at: "2026-09-01T00:00:00.000Z",
    email_confirmed_at: null,
    has_password: false as const,
  };
}

function fullCourseStudent() {
  return {
    user_id: "student-full",
    email: "full@example.com",
    invited_at: "2026-09-01T00:00:00.000Z",
    email_confirmed_at: "2026-09-01T00:05:00.000Z",
    last_sign_in_at: "2026-09-01T00:05:00.000Z",
    has_password: false as const,
  };
}

test("permanent activate URL is the same for every student", () => {
  assert.equal(ACTIVATE_PATH, "/activate");
  assert.equal(publicActivateUrl(), "https://iac.accountingstudyadvice.com/activate");
  assert.equal(publicActivateUrl("https://iac.accountingstudyadvice.com/"), "https://iac.accountingstudyadvice.com/activate");
  assert.equal(activatePageHeading(), "Activate your Free Preview");
  assert.match(activatePageBody(), /email address your invitation was sent to/i);
  assert.equal(activatePageCta(), "Send my activation link");
  assert.equal(activateInboxHeading(), "Check your inbox");
  assert.match(activateInboxBody(), /If an account exists for that email/);
  assert.match(activateInboxBody(), /spam or junk/i);
});

test("existing unactivated Free Preview student is emailed on the existing account", async () => {
  assert.equal(shouldCreateAuthUserForPasswordSetup(), false);
  assert.equal(accountActivationStatus(previewStudent()), "needs_activation");
  const created: string[] = [];
  const entitlements: string[] = [];
  const result = await sendExistingUserPasswordSetup("preview@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => previewStudent(),
    confirmEmail: async () => undefined,
    sendRecoveryEmail: async (email, redirectTo) => {
      assert.equal(email, "preview@example.com");
      assert.match(redirectTo, /\/auth\/update-password\?type=recovery/);
      return { error: null };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "sent");
  assert.equal(result.emailed, true);
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(created.length, 0);
  assert.equal(entitlements.length, 0);
});

test("existing unactivated Full Course student is emailed without changing entitlement", async () => {
  assert.equal(accountActivationStatus(fullCourseStudent()), "needs_activation");
  let grants = 0;
  const result = await sendExistingUserPasswordSetup("full@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => fullCourseStudent(),
    confirmEmail: async () => undefined,
    sendRecoveryEmail: async () => ({ error: null }),
  });
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(result.emailed, true);
  assert.equal(grants, 0);
});

test("already-activated student does not create a second account or entitlement", async () => {
  const activated = {
    user_id: "student-activated",
    email: "ready@example.com",
    invited_at: "2026-08-01T00:00:00.000Z",
    email_confirmed_at: "2026-08-01T00:10:00.000Z",
    last_sign_in_at: "2026-09-10T00:00:00.000Z",
    has_password: true as const,
  };
  assert.equal(accountActivationStatus(activated), "activated");
  const result = await sendExistingUserPasswordSetup("ready@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => activated,
    confirmEmail: async () => {
      throw new Error("must not reconfirm an activated student");
    },
    sendRecoveryEmail: async () => ({ error: null }),
  });
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(result.message, publicPasswordSetupCopy());
});

test("unknown email does not enumerate accounts or create a user", async () => {
  const result = await sendExistingUserPasswordSetup("nobody@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => null,
    confirmEmail: async () => {
      throw new Error("must not confirm a missing user");
    },
    sendRecoveryEmail: async () => {
      throw new Error("must not email a missing user");
    },
  });
  assert.equal(result.reason, "not_found");
  assert.equal(result.emailed, false);
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(result.message, publicPasswordSetupCopy());
  assert.equal(activateInboxBody().includes("nobody@example.com"), false);
});

test("repeated activate submissions keep the existing user and rate-limit the email", async () => {
  let recoveries = 0;
  const deps = {
    siteUrl: "https://iac.accountingstudyadvice.com",
    now: new Date("2026-09-29T12:00:00.000Z"),
    findUser: async () => ({
      ...previewStudent(),
      recovery_sent_at: "2026-09-29T11:59:00.000Z",
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
  assert.equal(first.entitlement_changed, false);
  assert.equal(recoveries, 0);
  assert.equal(recentlySentRecovery("2026-09-29T11:59:00.000Z", new Date("2026-09-29T12:00:00.000Z")), true);
});

test("successful activation email preserves existing entitlement and progress", async () => {
  let progressResets = 0;
  const result = await sendExistingUserPasswordSetup("preview@example.com", {
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUser: async () => previewStudent(),
    confirmEmail: async () => undefined,
    sendRecoveryEmail: async () => ({ error: null }),
  });
  assert.equal(result.created_user, false);
  assert.equal(result.entitlement_changed, false);
  assert.equal(progressResets, 0);
  assert.equal(shouldCreateAuthUserForPasswordSetup(), false);
});

test("activate page and login reuse the existing password-setup route", () => {
  const page = readFileSync(resolve("app/activate/page.tsx"), "utf8");
  const form = readFileSync(resolve("components/student/ActivateAccountForm.tsx"), "utf8");
  const login = readFileSync(resolve("components/student/StudentLoginForm.tsx"), "utf8");
  const api = readFileSync(resolve("app/api/auth/password-setup/route.ts"), "utf8");
  assert.match(page, /ActivateAccountForm/);
  assert.match(form, /\/api\/auth\/password-setup/);
  assert.match(form, /activatePageCta/);
  assert.match(form, /activateInboxHeading/);
  assert.match(login, /ACTIVATE_PATH/);
  assert.match(login, /loginActivatePrompt/);
  assert.match(login, /Forgot password/);
  assert.match(login, /loginForgotPasswordHint/);
  assert.equal(loginActivatePrompt(), "Have a Free Preview but haven't activated your account yet?");
  assert.equal(loginActivateLinkLabel(), "Activate your account →");
  assert.match(loginForgotPasswordHint(), /already set a password/);
  assert.match(api, /sendPasswordSetupForEmail/);
  assert.doesNotMatch(form, /inviteUserByEmail|signUp|createUser|grantFullEntitlement/);
  assert.doesNotMatch(form, /This invitation link has expired or has already been used/);
});
