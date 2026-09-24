import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_PRODUCT } from "./commerce";
import {
  checkoutCouponSpec,
  checkoutDiscount,
  incrementSuccessfulInstallments,
  publicCheckoutError,
  shouldCountSubscriptionInstallment,
  stripeSecretKeyError,
} from "./stripe-commerce";

test("Stripe secret keys that are dashboard IDs are rejected", () => {
  assert.match(stripeSecretKeyError("mk_1II99exampleGhnr") || "", /key ID/);
  assert.equal(stripeSecretKeyError("sk_live_example"), null);
  assert.equal(stripeSecretKeyError("rk_test_example"), null);
  assert.match(publicCheckoutError(new Error("Invalid API key provided: mk_1II99***************Ghnr. This looks like the ID of an API key")), /sk_live_/);
});

test("referral and promo discounts do not stack", () => {
  assert.throws(
    () => checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST", promoPercent: 10 }),
    /cannot be combined/
  );
  assert.equal(checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 1635);
  assert.equal(checkoutDiscount({ option: "plan_6", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 300);
  assert.equal(checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, promoPercent: 10 }), 3270);
});

test("plan referral is baked into each invoice amount rather than a repeating coupon", () => {
  const spec = checkoutCouponSpec({
    option: "plan_6",
    product: FALLBACK_PRODUCT,
    referralCode: "JAN27-TEST",
    creditCents: 0,
  });
  assert.equal(spec.coupon, null);
  assert.equal(spec.applyCreditAsBalance, false);
});

test("plan referral plus course credit applies credit as customer balance on instalment 1", () => {
  const spec = checkoutCouponSpec({
    option: "plan_6",
    product: FALLBACK_PRODUCT,
    referralCode: "JAN27-TEST",
    creditCents: 3270,
  });
  assert.equal(spec.coupon, null);
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
