import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkLessonAccess } from "./accessControl";
import { accountAccessCopy } from "./account-access";
import {
  AUTO_SEND_WAITLIST_ON_DEPLOY,
  coachMayUseInviteEndpoints,
  complimentaryCreatesStripePurchase,
  invitationRedirectUrl,
  processCoachInvite,
  resolveInviteTargets,
  shouldGrantAccess,
  shouldSendInviteEmail,
  waitlistInviteAccess,
  wouldSendInvitationsOnDeploy,
  type CoachInviteDeps,
  type FoundAuthUser,
} from "./coach-invites";
import { formatUsdCents } from "./format-money";
import {
  INSTALMENT_PLAN_LABEL,
  INSTALMENT_REFERRAL_LABEL,
  INSTALMENT_TIMING_CLASS,
  INSTALMENT_TIMING_COPY,
} from "./instalment-copy";
import { composeLessonAvailability } from "./lesson-availability";
import { isCoachAccount } from "./roles";
import { studentUserFromAuth } from "./student-lesson";

const student = studentUserFromAuth({
  id: "student-1",
  email: "s1@test.com",
  user_metadata: { role: "admin" },
  app_metadata: {},
});

const coach = studentUserFromAuth({
  id: "coach-1",
  email: "yvonne@accountingstudyadvice.com",
  user_metadata: {},
  app_metadata: { role: "coach" },
});

const lead = { id: "lead-1", email: "waitlist@example.com", full_name: "Wait List" };

function fakeDeps(overrides?: {
  existing?: FoundAuthUser | null;
  entitlement?: { status: "free_preview" | "full"; source: "signup" | "stripe" | "admin" } | null;
}): CoachInviteDeps & {
  invited: string[];
  invitedData: object[];
  purchases: unknown[];
  grants: string[];
} {
  const invited: string[] = [];
  const invitedData: object[] = [];
  const purchases: unknown[] = [];
  const grants: string[] = [];
  let entitlement = overrides?.entitlement ?? null;
  return {
    invited,
    invitedData,
    purchases,
    grants,
    siteUrl: "https://iac.accountingstudyadvice.com",
    findUserByEmail: async () => overrides?.existing ?? null,
    inviteUserByEmail: async (email, options) => {
      invited.push(email);
      if (options.data) invitedData.push(options.data);
      return { user: { id: "new-user", email }, error: null };
    },
    getEntitlement: async () => entitlement,
    grantPreview: async () => {
      grants.push("preview");
      entitlement = { status: "free_preview", source: "signup" };
    },
    grantComplimentary: async () => {
      grants.push("complimentary");
      entitlement = { status: "full", source: "admin" };
    },
    upsertProfile: async () => undefined,
    updateWaitlist: async () => undefined,
    logEvent: async () => undefined,
  };
}

test("deployment itself sends no invitations", () => {
  assert.equal(AUTO_SEND_WAITLIST_ON_DEPLOY, false);
  assert.equal(wouldSendInvitationsOnDeploy(), false);
  const source = readFileSync(resolve("lib/coach-invites.ts"), "utf8");
  assert.equal(/processCoachInvite\(/.test(source.split("export async function processCoachInvite")[0]), false);
  const sql = readFileSync(resolve("supabase/waitlist-invites.sql"), "utf8");
  assert.match(sql, /Does NOT email anyone/i);
  assert.equal(/pg_net|http_request|net\.http|cron\.|inviteUserByEmail/i.test(sql), false);
});

test("coach can invite one waitlist person", async () => {
  const deps = fakeDeps();
  const result = await processCoachInvite(
    { action: "invite_waitlist", confirm: true, lead_ids: ["lead-1"] },
    coach,
    [lead],
    deps
  );
  assert.equal(result.ok, true);
  assert.equal(result.emails_sent, 1);
  assert.equal(deps.invited.length, 1);
  assert.equal(deps.invited[0], "waitlist@example.com");
  assert.equal(result.outcomes[0]?.access, "free_preview");
  assert.equal(result.outcomes[0]?.entitlement_status, "free_preview");
  assert.equal(result.outcomes[0]?.created_stripe_purchase, false);
  assert.equal(waitlistInviteAccess(), "free_preview");
  assert.deepEqual(deps.invitedData[0], { full_name: "Wait List", first_name: "Wait" });
});

test("normal student cannot use admin invitation or grant endpoints", async () => {
  assert.equal(coachMayUseInviteEndpoints(student), false);
  assert.equal(isCoachAccount(student), false);
  const deps = fakeDeps();
  const result = await processCoachInvite(
    { action: "invite_waitlist", confirm: true, lead_ids: ["lead-1"] },
    student,
    [lead],
    deps
  );
  assert.equal(result.status, 403);
  assert.equal(result.emails_sent, 0);
  assert.equal(deps.invited.length, 0);
  const grant = await processCoachInvite(
    { action: "add_student", confirm: true, name: "Self", email: "s1@test.com", access: "full_complimentary" },
    student,
    [],
    deps
  );
  assert.equal(grant.status, 403);
  assert.equal(deps.grants.includes("complimentary"), false);
});

test("duplicate email does not create a duplicate Auth user", async () => {
  const deps = fakeDeps({
    existing: { id: "existing-1", email: "waitlist@example.com" },
    entitlement: null,
  });
  const result = await processCoachInvite(
    { action: "invite_waitlist", confirm: true, lead_ids: ["lead-1"] },
    coach,
    [lead],
    deps
  );
  assert.equal(result.ok, true);
  assert.equal(result.emails_sent, 0);
  assert.equal(deps.invited.length, 0);
  assert.equal(result.outcomes[0]?.account_existed, true);
  assert.equal(result.outcomes[0]?.auth_user_created, false);
  assert.equal(result.outcomes[0]?.password_changed, false);
});

test("existing account can be granted free-preview access", async () => {
  const deps = fakeDeps({
    existing: { id: "existing-1", email: "person@example.com" },
    entitlement: null,
  });
  const result = await processCoachInvite(
    { action: "add_student", confirm: true, name: "Existing", email: "person@example.com", access: "free_preview" },
    coach,
    [],
    deps
  );
  assert.equal(result.ok, true);
  assert.deepEqual(deps.grants, ["preview"]);
  assert.equal(result.outcomes[0]?.entitlement_status, "free_preview");
  assert.equal(result.outcomes[0]?.email_sent, false);
  assert.equal(result.outcomes[0]?.password_changed, false);
});

test("existing account can be granted complimentary full access", async () => {
  const deps = fakeDeps({
    existing: { id: "existing-2", email: "guest@example.com" },
    entitlement: { status: "free_preview", source: "signup" },
  });
  const result = await processCoachInvite(
    {
      action: "add_student",
      confirm: true,
      name: "Guest",
      email: "guest@example.com",
      access: "full_complimentary",
    },
    coach,
    [],
    deps
  );
  assert.equal(result.ok, true);
  assert.deepEqual(deps.grants, ["complimentary"]);
  assert.equal(result.outcomes[0]?.entitlement_status, "full");
  assert.equal(result.outcomes[0]?.entitlement_source, "admin");
  assert.equal(result.outcomes[0]?.created_stripe_purchase, false);
  assert.equal(result.outcomes[0]?.created_referral, false);
  assert.equal(complimentaryCreatesStripePurchase(), false);
});

test("new complimentary user receives full commercial entitlement but normal pedagogical gates still apply", () => {
  const catalog = [
    { id: "task-1", title: "Task 1", requires_submission: true },
    { id: "task-2", title: "Task 2", prereq_lesson_id: "task-1" },
  ];
  const pedagogical = checkLessonAccess(catalog[1], catalog, {}, { completed: {} });
  const composed = composeLessonAvailability({ commercialCanRead: true, pedagogical });
  assert.equal(composed.layer, "progression");
  assert.equal(composed.canReadBody, false);
  assert.match(composed.access.reason || "", /submission/i);
  assert.deepEqual(accountAccessCopy("full", "admin"), {
    title: "Full course access — complimentary",
    body: "You have complimentary full access to the IAC Skills Course on this account. This was granted by the course team, not purchased.",
  });
});

test("complimentary access does not create a Stripe purchase", async () => {
  const deps = fakeDeps();
  const result = await processCoachInvite(
    {
      action: "add_student",
      confirm: true,
      name: "Lecturer",
      email: "lecturer@example.com",
      access: "full_complimentary",
    },
    coach,
    [],
    deps
  );
  assert.equal(result.outcomes[0]?.created_stripe_purchase, false);
  assert.equal(deps.purchases.length, 0);
  assert.equal(result.outcomes[0]?.entitlement_source, "admin");
});

test("waitlist invitation produces free-preview access, not paid access", async () => {
  const resolved = resolveInviteTargets({ action: "invite_waitlist", confirm: true, lead_ids: ["lead-1"] }, [lead]);
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.equal(resolved.targets[0]?.access, "free_preview");
  const deps = fakeDeps();
  const result = await processCoachInvite(
    { action: "invite_waitlist", confirm: true, lead_ids: ["lead-1"] },
    coach,
    [lead],
    deps
  );
  assert.equal(result.outcomes[0]?.entitlement_status, "free_preview");
  assert.notEqual(result.outcomes[0]?.entitlement_source, "stripe");
  assert.equal(result.outcomes[0]?.created_stripe_purchase, false);
});

test("referral display renders US$32.70", () => {
  assert.equal(formatUsdCents(3270), "US$32.70");
  const card = readFileSync(resolve("components/commerce/ReferralCard.tsx"), "utf8");
  assert.match(card, /formatUsdCents/);
  assert.equal(/toFixed\(0\)/.test(card), false);
});

test("instalment payment-date statement is prominent magenta, not grey fine print", () => {
  assert.equal(INSTALMENT_PLAN_LABEL, "6 monthly instalments of US$60");
  assert.equal(
    INSTALMENT_TIMING_COPY,
    "First instalment when you enrol. Remaining five charged at the end of each following month."
  );
  assert.equal(INSTALMENT_REFERRAL_LABEL, "6 monthly instalments of US$57 (US$342 total)");
  const checkout = readFileSync(resolve("app/checkout/page.tsx"), "utf8");
  assert.match(checkout, /INSTALMENT_TIMING_CLASS/);
  assert.match(checkout, /INSTALMENT_TIMING_COPY/);
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  assert.match(css, new RegExp(`\\.${INSTALMENT_TIMING_CLASS}\\s*\\{[^}]*color:\\s*var\\(--link\\)`, "s"));
  assert.match(css, new RegExp(`\\.${INSTALMENT_TIMING_CLASS}\\s*\\{[^}]*font-size:\\s*1\\.125rem`, "s"));
  assert.equal(new RegExp(`\\.${INSTALMENT_TIMING_CLASS}\\s*\\{[^}]*muted`, "s").test(css), false);
});

test("unconfirmed or empty selections send no email", async () => {
  const deps = fakeDeps();
  const unconfirmed = await processCoachInvite(
    { action: "invite_waitlist", confirm: false, lead_ids: ["lead-1"] },
    coach,
    [lead],
    deps
  );
  assert.equal(unconfirmed.emails_sent, 0);
  assert.equal(deps.invited.length, 0);
  const empty = resolveInviteTargets({ action: "invite_waitlist", confirm: true, lead_ids: [] }, [lead]);
  assert.equal(empty.ok, false);
  assert.equal(shouldSendInviteEmail({ confirm: false, accountExists: false }), false);
  assert.equal(shouldGrantAccess({ status: "full", source: "stripe" }, "full_complimentary").grant, false);
});

test("invitation redirect uses the password-setup page", () => {
  assert.equal(
    invitationRedirectUrl("https://iac.accountingstudyadvice.com"),
    "https://iac.accountingstudyadvice.com/auth/update-password?type=invite"
  );
});
