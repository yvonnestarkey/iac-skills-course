import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { FALLBACK_PRODUCT, referrerCreditCents } from "./commerce";
import { notifyYvonneOfReferralExtraDiscount } from "./referral-arrangement-notify";
import {
  arrangementForEmail,
  buildReferralExtraInboxBody,
  buildReferralExtraNotifyEmail,
  extraDiscountCents,
  referralArrangementBanner,
  referralExtraInboxContext,
  referralExtraNotifyIdempotencyKey,
  referralExtraNotifySubject,
} from "./referral-arrangements";

test("Tchipara97 has an extra 5% arrangement on top of the standard 10% referral credit", () => {
  const arrangement = arrangementForEmail("Tchipara97@gmail.com");
  assert.ok(arrangement);
  assert.equal(arrangement.extraBps, 500);
  assert.equal(extraDiscountCents(arrangement.extraBps, FALLBACK_PRODUCT), 1635);
  assert.equal(referrerCreditCents("plan_6", FALLBACK_PRODUCT), 3270);
  assert.match(arrangement.action, /another 5%/i);
  assert.equal(arrangementForEmail("someone-else@example.com"), null);
});

test("activation notice tells Yvonne to add the extra 5% and does not apply it automatically", async () => {
  const content = {
    studentName: "Tchipara97",
    studentEmail: "tchipara97@gmail.com",
    studentId: "student-1",
    creditCents: 3270,
    extraCents: 1635,
    extraBps: 500,
    action: "Add another 5% to his discount as part of our arrangement.",
    profileUrl: "https://iac.accountingstudyadvice.com/coach/students/student-1",
  };
  const email = buildReferralExtraNotifyEmail(content);
  assert.equal(email.subject, referralExtraNotifySubject("Tchipara97"));
  assert.match(email.text, /10% referral credit is now active/);
  assert.match(email.text, /US\$32\.70/);
  assert.match(email.text, /US\$16\.35/);
  assert.match(email.text, /Stripe customer balance/);
  assert.doesNotMatch(email.text, /has been applied automatically/i);

  const inbox = buildReferralExtraInboxBody(content);
  assert.match(inbox, /SYSTEM REMINDER/);
  assert.match(inbox, /not a student message/);
  assert.match(inbox, /tchipara97@gmail.com/);
  assert.equal(referralExtraInboxContext("reward-1"), "referral-extra:reward-1");
  assert.equal(referralExtraNotifyIdempotencyKey("reward-1"), "iac-referral-extra-reward-1");
  assert.match(referralArrangementBanner("waiting", 1635), /Waiting for a friend/);
  assert.match(referralArrangementBanner("action_needed", 1635), /now active/);

  const sent: string[] = [];
  const result = await notifyYvonneOfReferralExtraDiscount(
    {
      referrerUserId: "student-1",
      rewardId: "reward-1",
      creditCents: 3270,
      product: FALLBACK_PRODUCT,
      studentName: "Tchipara97",
      studentEmail: "tchipara97@gmail.com",
    },
    async (payload) => {
      sent.push(payload.subject);
      assert.equal(payload.idempotencyKey, "iac-referral-extra-reward-1");
      assert.match(payload.text, /Add another 5%/);
      return { id: "email-1" };
    },
    async () => true
  );
  assert.equal(result.sent, true);
  assert.equal(result.inbox, true);
  assert.equal(sent[0], "Add extra 5% — Tchipara97 referral credit is now active");
});

test("students without an arrangement do not notify Yvonne", async () => {
  const result = await notifyYvonneOfReferralExtraDiscount(
    {
      referrerUserId: "other-student",
      rewardId: "reward-2",
      creditCents: 3270,
      product: FALLBACK_PRODUCT,
      studentName: "Other",
      studentEmail: "other@example.com",
    },
    async () => {
      throw new Error("should not send");
    },
    async () => {
      throw new Error("should not write inbox");
    }
  );
  assert.equal(result.sent, false);
  assert.equal(result.reason, "no_arrangement");
});

test("qualifying referred purchase notifies Yvonne of the extra 5% arrangement", () => {
  const source = readFileSync(resolve("lib/stripe-commerce.ts"), "utf8");
  assert.match(source, /await applyEarnedCreditToOpenPlan[\s\S]*await notifyYvonneOfReferralExtraDiscount/);
});

test("coach surfaces show the extra 5% arrangement", () => {
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const referrals = readFileSync(resolve("components/coach/CoachReferralsPage.tsx"), "utf8");
  const inbox = readFileSync(resolve("lib/referral-arrangement-notify.ts"), "utf8");
  assert.match(profile, /referralArrangementBanner/);
  assert.match(referrals, /Special extra-discount arrangements/);
  assert.match(inbox, /student_id: null/);
});
