import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  generateTemporaryPassword,
  setTemporaryPassword,
  TEMPORARY_PASSWORD_MIN_LENGTH,
  validateTemporaryPassword,
} from "./set-temporary-password";

test("generated temporary passwords meet the minimum strength", () => {
  const password = generateTemporaryPassword();
  assert.equal(validateTemporaryPassword(password), password);
  assert.ok(password.length >= TEMPORARY_PASSWORD_MIN_LENGTH);
  assert.equal(/\s/.test(password), false);
});

test("setTemporaryPassword updates Auth and never keeps the plaintext password", async () => {
  const calls: Array<{ userId: string; password: string }> = [];
  const result = await setTemporaryPassword(
    { userId: "student-1", password: "TempPass12" },
    {
      async updateUserPassword(userId, password) {
        calls.push({ userId, password });
        return { email: "student@example.com" };
      },
    }
  );
  assert.deepEqual(result, { ok: true, user_id: "student-1", email: "student@example.com" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, "student-1");
  assert.equal(calls[0].password, "TempPass12");
  assert.equal("password" in result, false);
});

test("setTemporaryPassword rejects a weak password before calling Auth", async () => {
  let called = 0;
  const result = await setTemporaryPassword(
    { userId: "student-1", password: "short" },
    {
      async updateUserPassword() {
        called += 1;
        return {};
      },
    }
  );
  assert.equal(result.ok, false);
  assert.equal(called, 0);
});

test("coach API sets the password with updateUserById and keeps the service role on the server", () => {
  const route = readFileSync(resolve("app/api/coach/set-temporary-password/route.ts"), "utf8");
  const admin = readFileSync(resolve("lib/set-temporary-password-admin.ts"), "utf8");
  const panel = readFileSync(resolve("components/coach/SetTemporaryPasswordPanel.tsx"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  assert.match(route, /isStaffUser/);
  assert.match(route, /setTemporaryPasswordForUser/);
  assert.doesNotMatch(route, /console\.(log|info|debug|error|warn)/);
  assert.match(admin, /auth\.admin\.updateUserById/);
  assert.match(admin, /getServiceSupabase/);
  assert.match(admin, /password: nextPassword/);
  assert.doesNotMatch(panel, /SUPABASE_SERVICE_ROLE_KEY|getServiceSupabase|updateUserById/);
  assert.match(profile, /SetTemporaryPasswordPanel/);
  assert.match(panel, /\/api\/coach\/set-temporary-password/);
  assert.match(panel, /Copy/);
  assert.match(panel, /Generate/);
});

test("existing password-reset flow is unchanged", () => {
  const recovery = readFileSync(resolve("app/api/coach/account-recovery/route.ts"), "utf8");
  const setup = readFileSync(resolve("app/api/auth/password-setup/route.ts"), "utf8");
  const login = readFileSync(resolve("components/student/StudentLoginForm.tsx"), "utf8");
  assert.match(recovery, /sendPasswordSetupForEmail/);
  assert.doesNotMatch(recovery, /setTemporaryPassword/);
  assert.match(setup, /sendPasswordSetupForEmail/);
  assert.doesNotMatch(setup, /setTemporaryPassword/);
  assert.match(login, /Forgot password/);
});
