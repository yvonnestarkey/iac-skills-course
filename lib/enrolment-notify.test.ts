import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildEnrolmentNotifyEmail,
  enrolmentNotifyIdempotencyKey,
  enrolmentNotifySubject,
  notifyYvonneOfSuccessfulEnrolment,
  shouldNotifyYvonneOfEnrolment,
} from "./enrolment-notify";

test("once-off enrolment notifies Yvonne", async () => {
  assert.equal(
    shouldNotifyYvonneOfEnrolment({
      entitlementStatus: "full",
      entitlementSource: "stripe",
      option: "once_off",
      eventType: "checkout.session.completed",
    }),
    true
  );
  const sent: string[] = [];
  const result = await notifyYvonneOfSuccessfulEnrolment(
    {
      userId: "student-1",
      purchaseId: "purchase-1",
      option: "once_off",
      amountPaidNowCents: 32700,
      entitlementStatus: "full",
      entitlementSource: "stripe",
      eventType: "checkout.session.completed",
      studentName: "Ada Student",
      studentEmail: "ada@example.com",
      enrolledAt: new Date("2026-09-28T10:00:00.000Z"),
    },
    async (payload) => {
      sent.push(payload.subject);
      assert.equal(payload.idempotencyKey, enrolmentNotifyIdempotencyKey("purchase-1"));
      assert.match(payload.text, /Once-off/);
      assert.match(payload.text, /US\$327\.00/);
      assert.match(payload.text, /ada@example.com/);
      assert.doesNotMatch(payload.text, /first of 6/);
      return { id: "email-1" };
    }
  );
  assert.equal(result.sent, true);
  assert.equal(sent[0], "New IAC enrolment — Ada Student");
});

test("instalment-plan enrolment is the first of 6 payments", async () => {
  const email = buildEnrolmentNotifyEmail({
    studentName: "Plan Student",
    studentEmail: "plan@example.com",
    option: "plan_6",
    amountPaidNowCents: 6000,
    planCount: 6,
    remainingInstallmentDates: [new Date("2026-10-31T12:00:00.000Z"), new Date("2026-11-30T12:00:00.000Z")],
    referralCode: "JAN27-TEST",
    enrolledAt: new Date("2026-09-28T10:00:00.000Z"),
  });
  assert.equal(enrolmentNotifySubject("Plan Student"), "New IAC enrolment — Plan Student");
  assert.match(email.text, /6-payment plan/);
  assert.match(email.text, /US\$60\.00/);
  assert.match(email.text, /first of 6 payments/);
  assert.match(email.text, /2 instalments remain/);
  assert.match(email.text, /Referral code JAN27-TEST/);
});

test("Stripe webhook retry does not send a duplicate enrolment email", async () => {
  assert.equal(
    shouldNotifyYvonneOfEnrolment({
      duplicateStripeEvent: true,
      entitlementStatus: "full",
      entitlementSource: "stripe",
      option: "once_off",
      eventType: "checkout.session.completed",
    }),
    false
  );
  let sends = 0;
  const first = await notifyYvonneOfSuccessfulEnrolment(
    {
      userId: "student-1",
      purchaseId: "purchase-1",
      option: "once_off",
      amountPaidNowCents: 32700,
      entitlementStatus: "full",
      entitlementSource: "stripe",
      eventType: "checkout.session.completed",
      studentName: "Ada Student",
      studentEmail: "ada@example.com",
    },
    async () => {
      sends += 1;
      return { id: "email-1" };
    }
  );
  const retry = await notifyYvonneOfSuccessfulEnrolment(
    {
      userId: "student-1",
      purchaseId: "purchase-1",
      option: "once_off",
      amountPaidNowCents: 32700,
      entitlementStatus: "full",
      entitlementSource: "stripe",
      eventType: "checkout.session.completed",
      duplicateStripeEvent: true,
      studentName: "Ada Student",
      studentEmail: "ada@example.com",
    },
    async () => {
      sends += 1;
      return { id: "email-2" };
    }
  );
  assert.equal(first.sent, true);
  assert.equal(retry.sent, false);
  assert.equal(sends, 1);
});

test("later instalments do not send a new enrolment email", () => {
  assert.equal(
    shouldNotifyYvonneOfEnrolment({
      entitlementStatus: "full",
      entitlementSource: "stripe",
      option: "plan_6",
      eventType: "invoice.paid",
    }),
    false
  );
});

test("Free Preview registration does not send an enrolment email", () => {
  assert.equal(
    shouldNotifyYvonneOfEnrolment({
      entitlementStatus: "free_preview",
      entitlementSource: "signup",
      option: "once_off",
      eventType: "checkout.session.completed",
    }),
    false
  );
  assert.equal(
    shouldNotifyYvonneOfEnrolment({
      entitlementStatus: "full",
      entitlementSource: "admin",
      option: "once_off",
      eventType: "checkout.session.completed",
    }),
    false
  );
  assert.equal(
    shouldNotifyYvonneOfEnrolment({
      smokeTest: true,
      entitlementStatus: "full",
      entitlementSource: "stripe",
      option: "once_off",
      eventType: "checkout.session.completed",
    }),
    false
  );
});

test("notification failure does not prevent Full Course access", async () => {
  let entitlement: "free_preview" | "full" = "free_preview";
  const grantFull = async () => {
    entitlement = "full";
  };
  await grantFull();
  const result = await notifyYvonneOfSuccessfulEnrolment(
    {
      userId: "student-1",
      purchaseId: "purchase-1",
      option: "once_off",
      amountPaidNowCents: 32700,
      entitlementStatus: entitlement,
      entitlementSource: "stripe",
      eventType: "checkout.session.completed",
      studentName: "Ada Student",
      studentEmail: "ada@example.com",
    },
    async () => {
      throw new Error("Resend unavailable");
    }
  );
  assert.equal(entitlement, "full");
  assert.equal(result.sent, false);
  assert.match(result.reason || "", /Resend unavailable/);
});

test("webhook sends the enrolment notice after fulfilment, not on later invoices", () => {
  const source = readFileSync(resolve("app/api/stripe/webhook/route.ts"), "utf8");
  const fulfillIdx = source.indexOf("await fulfillSuccessfulPayment");
  const notifyIdx = source.indexOf("await notifyYvonneOfSuccessfulEnrolment");
  const invoiceIdx = source.indexOf('event.type === "invoice.paid"');
  assert.ok(fulfillIdx >= 0);
  assert.ok(notifyIdx > fulfillIdx);
  assert.ok(invoiceIdx > notifyIdx);
  assert.doesNotMatch(source.slice(invoiceIdx), /await notifyYvonneOfSuccessfulEnrolment/);
});
