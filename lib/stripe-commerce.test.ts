import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_PRODUCT } from "./commerce";
import { checkoutDiscount } from "./stripe-commerce";

test("referral and promo discounts do not stack", () => {
  assert.throws(
    () => checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST", promoPercent: 10 }),
    /cannot be combined/
  );
  assert.equal(checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, referralCode: "JAN27-TEST" }), 1635);
  assert.equal(checkoutDiscount({ option: "once_off", product: FALLBACK_PRODUCT, promoPercent: 10 }), 3270);
});
