import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_PRODUCT,
  canStackDiscounts,
  discountCents,
  refereeDiscountCents,
  refereePerInstallmentCents,
  referrerCreditCents,
  selectedOptionTotalCents,
  stripProtectedLesson,
} from "./commerce";

test("once-off and plan prices stay in USD cents", () => {
  assert.equal(FALLBACK_PRODUCT.once_off_amount_cents, 32700);
  assert.equal(FALLBACK_PRODUCT.plan_amount_cents, 6000);
  assert.equal(FALLBACK_PRODUCT.plan_count, 6);
  assert.notEqual(FALLBACK_PRODUCT.plan_amount_cents * FALLBACK_PRODUCT.plan_count, FALLBACK_PRODUCT.once_off_amount_cents);
});

test("referral percentages are USD-based and do not stack", () => {
  assert.equal(selectedOptionTotalCents("once_off", FALLBACK_PRODUCT), 32700);
  assert.equal(selectedOptionTotalCents("plan_6", FALLBACK_PRODUCT), 36000);
  assert.equal(refereeDiscountCents("once_off", FALLBACK_PRODUCT), 1635);
  assert.equal(refereeDiscountCents("plan_6", FALLBACK_PRODUCT), 1800);
  assert.equal(refereePerInstallmentCents("once_off", FALLBACK_PRODUCT), 1635);
  assert.equal(refereePerInstallmentCents("plan_6", FALLBACK_PRODUCT), 300);
  assert.equal(referrerCreditCents("once_off", FALLBACK_PRODUCT), 3270);
  assert.equal(referrerCreditCents("plan_6", FALLBACK_PRODUCT), 3270);
  assert.equal(canStackDiscounts(), false);
  assert.equal(discountCents(32700, 500), 1635);
});

test("stripProtectedLesson removes paid body and assets", () => {
  const stripped = stripProtectedLesson({
    id: "ch10-l7",
    title: "Task 1",
    body: ["secret"],
    pdf_url: "https://example.com/paid.pdf",
    video_urls: ["https://vimeo.com/1"],
  });
  assert.deepEqual(stripped.body, []);
  assert.equal(stripped.pdf_url, null);
  assert.equal(stripped.video_urls, null);
  assert.equal(stripped.title, "Task 1");
});
