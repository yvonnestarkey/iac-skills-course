import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  accountProfileFromSources,
  keptProfileIdentity,
  normalizeAccountProfile,
  validateAccountProfile,
} from "./account-profile";

test("account profile validation requires a name and a real email", () => {
  assert.equal(validateAccountProfile(normalizeAccountProfile({ email: "ada@example.com" })), "Enter your name.");
  assert.equal(
    validateAccountProfile(normalizeAccountProfile({ full_name: "Ada", email: "not-an-email" })),
    "Enter a valid email address."
  );
  assert.equal(
    validateAccountProfile(
      normalizeAccountProfile({
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        accountability_email: "nudge-me",
      })
    ),
    "Enter a valid accountability email, or leave it blank."
  );
  assert.equal(
    validateAccountProfile(
      normalizeAccountProfile({
        full_name: "  Ada Lovelace  ",
        email: "Ada@Example.com",
        phone_number: " +27 82 123 4567 ",
        accountability_email: "",
      })
    ),
    null
  );
});

test("existing profile name and email are not overwritten by auth fallbacks", () => {
  assert.deepEqual(
    keptProfileIdentity({ email: "saved@example.com", full_name: "Saved Name" }, { email: "auth@example.com", full_name: "Auth Name" }),
    { email: "saved@example.com", full_name: "Saved Name" }
  );
  assert.deepEqual(
    keptProfileIdentity({ email: "", full_name: null }, { email: "auth@example.com", full_name: "Auth Name" }),
    { email: "auth@example.com", full_name: "Auth Name" }
  );
});

test("profile sources prefer the saved row over the login email", () => {
  assert.deepEqual(
    accountProfileFromSources({
      profile: {
        email: "new@example.com",
        full_name: "Ada",
        phone_number: "+27 1",
        accountability_email: "nudge@example.com",
      },
      email: "old@example.com",
      full_name: "Old",
    }),
    {
      email: "new@example.com",
      full_name: "Ada",
      phone_number: "+27 1",
      accountability_email: "nudge@example.com",
    }
  );
});

test("students and coaches can edit their own profile", () => {
  const api = readFileSync(resolve("app/api/profile/route.ts"), "utf8");
  const editor = readFileSync(resolve("components/account/ProfileEditor.tsx"), "utf8");
  const student = readFileSync(resolve("components/student/StudentAccount.tsx"), "utf8");
  const coach = readFileSync(resolve("app/coach/account/page.tsx"), "utf8");
  const shell = readFileSync(resolve("components/student/StudentShell.tsx"), "utf8");
  const topbar = readFileSync(resolve("components/TopBar.tsx"), "utf8");
  const profiles = readFileSync(resolve("lib/profiles.ts"), "utf8");
  assert.match(api, /export async function GET/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /auth\.updateUser/);
  assert.match(editor, /Save profile/);
  assert.match(editor, /profile-phone/);
  assert.match(student, /ProfileEditor/);
  assert.match(coach, /ProfileEditor/);
  assert.match(shell, /\/student\/account/);
  assert.match(topbar, /\/coach\/account/);
  assert.match(topbar, /onClick=\{\(\) => router.push\("\/coach"\)\}/);
  assert.match(profiles, /keptProfileIdentity/);
});
