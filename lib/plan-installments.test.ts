import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_PRODUCT, refereeDiscountCents, referrerCreditCents } from "./commerce";
import { composeLessonAvailability } from "./lesson-availability";
import {
  calendarMonthEndUtc,
  enrollmentCalendarMonthKey,
  futurePlanInvoiceDrafts,
  installmentNumberFromInvoice,
  planCheckoutPaymentParams,
  planInstallmentAmountCents,
  planInstallmentDates,
  planInstallmentTotalCents,
  shouldCountPlanInstallmentInvoice,
  voidActionForInvoiceStatus,
} from "./plan-installments";
import { incrementSuccessfulInstallments, shouldCountSubscriptionInstallment } from "./stripe-commerce";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertMonthEndSequence(enrolledAt: Date, expected: string[]) {
  const dates = planInstallmentDates(enrolledAt, 6);
  assert.equal(dates.length, 6);
  assert.equal(ymd(dates[0]), expected[0]);
  assert.deepEqual(dates.slice(1).map(ymd), expected.slice(1));
  const enrollMonth = enrollmentCalendarMonthKey(enrolledAt);
  assert.equal(
    dates.slice(1).some((date) => enrollmentCalendarMonthKey(date) === enrollMonth),
    false
  );
  const drafts = futurePlanInvoiceDrafts({
    enrolledAt,
    purchaseId: "p1",
    productId: "jan27-iac",
    userId: "u1",
    amountCents: 6000,
  });
  assert.equal(drafts.length, 5);
  assert.deepEqual(
    drafts.map((draft) => draft.installment),
    [2, 3, 4, 5, 6]
  );
  assert.ok(drafts.every((draft) => draft.collectionMethod === "charge_automatically"));
  assert.ok(drafts.every((draft) => draft.amountCents === 6000));
  assert.ok(drafts.every((draft) => draft.automaticallyFinalizesAt === Math.floor(draft.scheduledAt.getTime() / 1000)));
}

test("signup Jan 1 bills immediately then five month-ends", () => {
  assertMonthEndSequence(new Date("2027-01-01T00:00:00.000Z"), [
    "2027-01-01",
    "2027-02-28",
    "2027-03-31",
    "2027-04-30",
    "2027-05-31",
    "2027-06-30",
  ]);
});

test("signup Jan 15 bills immediately then five month-ends", () => {
  assertMonthEndSequence(new Date("2027-01-15T12:00:00.000Z"), [
    "2027-01-15",
    "2027-02-28",
    "2027-03-31",
    "2027-04-30",
    "2027-05-31",
    "2027-06-30",
  ]);
});

test("signup Jan 31 never creates a second January instalment", () => {
  assertMonthEndSequence(new Date("2027-01-31T23:00:00.000Z"), [
    "2027-01-31",
    "2027-02-28",
    "2027-03-31",
    "2027-04-30",
    "2027-05-31",
    "2027-06-30",
  ]);
});

test("February in a normal year uses Feb 28", () => {
  assertMonthEndSequence(new Date("2027-02-15T09:00:00.000Z"), [
    "2027-02-15",
    "2027-03-31",
    "2027-04-30",
    "2027-05-31",
    "2027-06-30",
    "2027-07-31",
  ]);
});

test("February in a leap year uses Feb 29", () => {
  assert.equal(ymd(calendarMonthEndUtc(2028, 1)), "2028-02-29");
  assertMonthEndSequence(new Date("2028-01-20T00:00:00.000Z"), [
    "2028-01-20",
    "2028-02-29",
    "2028-03-31",
    "2028-04-30",
    "2028-05-31",
    "2028-06-30",
  ]);
});

test("30-day month rolls to 31-day month-end and 31-day rolls to a shorter month", () => {
  assertMonthEndSequence(new Date("2027-04-30T08:00:00.000Z"), [
    "2027-04-30",
    "2027-05-31",
    "2027-06-30",
    "2027-07-31",
    "2027-08-31",
    "2027-09-30",
  ]);
  assert.equal(ymd(calendarMonthEndUtc(2027, 0)), "2027-01-31");
  assert.equal(ymd(calendarMonthEndUtc(2027, 1)), "2027-02-28");
});

test("standard plan is six US$60 instalments and referral plan is six US$57 instalments", () => {
  assert.equal(planInstallmentAmountCents({ product: FALLBACK_PRODUCT }), 6000);
  assert.equal(planInstallmentTotalCents({ product: FALLBACK_PRODUCT }), 36000);
  assert.equal(planInstallmentAmountCents({ product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 5700);
  assert.equal(planInstallmentTotalCents({ product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 34200);
  const drafts = futurePlanInvoiceDrafts({
    enrolledAt: new Date("2027-01-15T00:00:00.000Z"),
    purchaseId: "p1",
    productId: FALLBACK_PRODUCT.id,
    userId: "u1",
    amountCents: 5700,
  });
  assert.equal(drafts.length, 5);
  assert.ok(drafts.every((draft) => draft.amountCents === 5700));
  assert.equal(5700 + drafts.reduce((sum, draft) => sum + draft.amountCents, 0), 34200);
});

test("plan checkout saves an off-session card and does not create a subscription", () => {
  const params = planCheckoutPaymentParams({
    customerId: "cus_1",
    installmentCents: 6000,
    planCount: 6,
    metadata: { user_id: "u1", product_id: "jan27-iac", option: "plan_6", purchase_id: "p1" },
  });
  assert.equal(params.mode, "payment");
  assert.equal(params.payment_intent_data.setup_future_usage, "off_session");
  assert.equal(params.invoice_creation.enabled, true);
  assert.equal(params.line_items[0].price_data.unit_amount, 6000);
  assert.equal("subscription_data" in params, false);
});

test("later plan invoices are not treated as subscription-cycle events", () => {
  assert.equal(
    shouldCountSubscriptionInstallment({
      id: "in_2",
      status: "paid",
      amount_paid: 5700,
      billing_reason: "manual",
    }),
    false
  );
  assert.equal(
    shouldCountPlanInstallmentInvoice({
      id: "in_2",
      status: "paid",
      amount_paid: 5700,
      metadata: { option: "plan_6", installment: "2" },
    }),
    true
  );
});

test("paid plan invoices update payment state and ignore duplicates", () => {
  const invoice = {
    id: "in_2",
    status: "paid",
    amount_paid: 6000,
    metadata: { option: "plan_6", installment: "2", purchase_id: "p1" },
  };
  assert.equal(shouldCountPlanInstallmentInvoice(invoice), true);
  assert.equal(installmentNumberFromInvoice(invoice), 2);
  assert.deepEqual(incrementSuccessfulInstallments({ current: 1, lastInvoiceId: "in_1", invoiceId: "in_2" }), {
    count: 2,
    changed: true,
  });
  assert.deepEqual(incrementSuccessfulInstallments({ current: 2, lastInvoiceId: "in_2", invoiceId: "in_2" }), {
    count: 2,
    changed: false,
  });
});

test("failed future invoice is past_due and does not remove commercial access", () => {
  const failed = composeLessonAvailability({
    commercialCanRead: true,
    pedagogical: { isLocked: false },
  });
  assert.equal(failed.canReadBody, true);
  assert.notEqual(failed.layer, "purchase");
});

test("once-off referral and referrer credit stay at US$310.65 and US$32.70", () => {
  assert.equal(refereeDiscountCents("once_off", FALLBACK_PRODUCT), 1635);
  assert.equal(FALLBACK_PRODUCT.once_off_amount_cents - 1635, 31065);
  assert.equal(referrerCreditCents("once_off", FALLBACK_PRODUCT), 3270);
  assert.equal(referrerCreditCents("plan_6", FALLBACK_PRODUCT), 3270);
});

test("refund voids only uncollected invoices", () => {
  assert.equal(voidActionForInvoiceStatus("draft"), "delete");
  assert.equal(voidActionForInvoiceStatus("open"), "void");
  assert.equal(voidActionForInvoiceStatus("uncollectible"), "void");
  assert.equal(voidActionForInvoiceStatus("paid"), "skip");
  assert.equal(voidActionForInvoiceStatus("void"), "skip");
});
