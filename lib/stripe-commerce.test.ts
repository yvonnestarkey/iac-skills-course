import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_PRODUCT } from "./commerce";
import {
  checkoutCouponSpec,
  checkoutDiscount,
  incrementSuccessfulInstallments,
  shouldCountSubscriptionInstallment,
} from "./stripe-commerce";

test("referral and promo discounts do not stack", () => {
  assert.throws(
    () => checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST", promoPercent: 10 }),
    /cannot be combined/
  );
  assert.equal(checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 1635);
  assert.equal(checkoutDiscount({ option: "plan_6", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 300);
  assert.equal(checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, promoPercent: 10 }), 3270);
});

test("plan referral coupon repeats across all six instalments", () => {
  const spec = checkoutCouponSpec({
    option: "plan_6",
    product: FALLBACK_PRODUCT,
    referralCode: "JAN27-TEST",
    creditCents: 0,
  });
  assert.equal(spec.coupon?.amount_off, 300);
  assert.equal(spec.coupon?.duration, "repeating");
  assert.equal(spec.coupon?.duration_in_months, 6);
  assert.equal(spec.applyCreditAsBalance, false);
});

test("plan referral plus course credit keeps the repeating $3 coupon", () => {
  const spec = checkoutCouponSpec({
    option: "plan_6",
    product: FALLBACK_PRODUCT,
    referralCode: "JAN27-TEST",
    creditCents: 3270,
  });
  assert.equal(spec.coupon?.amount_off, 300);
  assert.equal(spec.coupon?.duration, "repeating");
  assert.equal(spec.applyCreditAsBalance, true);
});

test("once-off referral remains a single $16.35 coupon", () => {
  const spec = checkoutCouponSpec({
    option: "once_off",
    product: FALLBACK_PRODUCT,
    referralCode: "JAN27-TEST",
    creditCents: 0,
  });
  assert.equal(spec.coupon?.amount_off, 1635);
  assert.equal(spec.coupon?.duration, "once");
});

test("successful instalments count paid cycle invoices once", () => {
  assert.equal(
    shouldCountSubscriptionInstallment({
      id: "in_1",
      status: "paid",
      amount_paid: 5700,
      billing_reason: "subscription_create",
    }),
    true
  );
  assert.equal(
    shouldCountSubscriptionInstallment({
      id: "in_2",
      status: "paid",
      amount_paid: 5700,
      billing_reason: "subscription_cycle",
    }),
    true
  );
  assert.equal(
    shouldCountSubscriptionInstallment({
      id: "in_3",
      status: "paid",
      amount_paid: 0,
      billing_reason: "subscription_cycle",
    }),
    false
  );
  assert.equal(
    shouldCountSubscriptionInstallment({
      id: "in_4",
      status: "paid",
      amount_paid: 5700,
      billing_reason: "manual",
    }),
    false
  );
  assert.deepEqual(incrementSuccessfulInstallments({ current: 1, lastInvoiceId: "in_1", invoiceId: "in_1" }), {
    count: 1,
    changed: false,
  });
  assert.deepEqual(incrementSuccessfulInstallments({ current: 5, lastInvoiceId: "in_5", invoiceId: "in_6" }), {
    count: 6,
    changed: true,
  });
});
