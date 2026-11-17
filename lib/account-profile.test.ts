import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  accountProfileFromSources,
  editablePersonName,
  isPlaceholderPersonName,
  joinPersonName,
  keptProfileIdentity,
  normalizeAccountProfile,
  splitPersonName,
  validateAccountProfile,
  validatePersonName,
} from "./account-profile";

test("account profile validation requires a first name, surname, and a real email", () => {
  assert.equal(validateAccountProfile(normalizeAccountProfile({ email: "ada@example.com" })), "Enter your first name.");
  assert.equal(
    validateAccountProfile(normalizeAccountProfile({ full_name: "Ada", email: "ada@example.com" })),
    "Enter your surname."
  );
  assert.equal(
    validateAccountProfile(normalizeAccountProfile({ full_name: "Ada Lovelace", email: "not-an-email" })),
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
  assert.deepEqual(
    keptProfileIdentity(
      { email: "eleanorraath.er20@gmail.com", full_name: "eleanorraath.er20" },
      { email: "eleanorraath.er20@gmail.com", full_name: "Eleanor Raath" }
    ),
    { email: "eleanorraath.er20@gmail.com", full_name: "Eleanor Raath" }
  );
});

test("email usernames are treated as placeholder names until first name and surname are saved", () => {
  assert.equal(isPlaceholderPersonName("eleanorraath.er20", "eleanorraath.er20@gmail.com"), true);
  assert.equal(isPlaceholderPersonName("Eleanorraath Er20", "eleanorraath.er20@gmail.com"), true);
  assert.equal(isPlaceholderPersonName("Eleanor Raath", "eleanorraath.er20@gmail.com"), false);
  assert.deepEqual(splitPersonName("Thandi Dube-Moyo"), { firstName: "Thandi", lastName: "Dube-Moyo" });
  assert.equal(joinPersonName("Thandi", "Dube-Moyo"), "Thandi Dube-Moyo");
  assert.deepEqual(editablePersonName("eleanorraath.er20", "eleanorraath.er20@gmail.com"), {
    firstName: "",
    lastName: "",
  });
  assert.equal(validatePersonName("Eleanor", ""), "Enter the surname.");
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
  assert.match(editor, /profile-first-name/);
  assert.match(editor, /profile-last-name/);
  assert.match(editor, /profile-phone/);
  assert.match(student, /ProfileEditor/);
  assert.match(student, /StudentOnboardingDetails/);
  assert.match(student, /useState\(false\)/);
  assert.match(coach, /ProfileEditor/);
  assert.match(shell, /\/student\/account/);
  assert.match(topbar, /\/coach\/account/);
  assert.match(topbar, /onClick=\{\(\) => router.push\("\/coach"\)\}/);
  assert.match(profiles, /keptProfileIdentity/);
});

test("coach student profile has a collapsed name and onboarding section", () => {
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const details = readFileSync(resolve("components/coach/StudentProfileDetails.tsx"), "utf8");
  const api = readFileSync(resolve("app/api/coach/student-profile/route.ts"), "utf8");
  const admin = readFileSync(resolve("lib/student-profile-admin.ts"), "utf8");
  const onboarding = readFileSync(resolve("components/student/OnboardingForm.tsx"), "utf8");
  const save = readFileSync(resolve("lib/onboarding.ts"), "utf8");
  assert.match(profile, /StudentProfileDetails/);
  assert.match(details, /useState\(false\)/);
  assert.match(details, /aria-expanded=\{open\}/);
  assert.match(details, /coach-student-first-name/);
  assert.match(details, /coach-student-last-name/);
  assert.match(details, /OnboardingFacts/);
  assert.match(details, /\/api\/coach\/student-profile/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /isStaffUser/);
  assert.match(admin, /auth\.admin\.updateUserById/);
  assert.doesNotMatch(details, /SUPABASE_SERVICE_ROLE_KEY|getServiceSupabase|updateUserById/);
  assert.match(onboarding, /onboarding-first-name/);
  assert.match(onboarding, /"Name"/);
  assert.match(save, /first_name/);
  assert.match(save, /fetchOwnOnboardingAnswers/);
});
