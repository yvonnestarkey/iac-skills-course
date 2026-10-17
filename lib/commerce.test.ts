import test from "node:test";
import assert from "node:assert/strict";
import { accountAccessCopy, unpaidPreviewReferralNote } from "./account-access";
import {
  FALLBACK_PRODUCT,
  canStackDiscounts,
  discountCents,
  refereeDiscountCents,
  refereePerInstallmentCents,
  referralCodeForUserId,
  referrerCreditCents,
  selectedOptionTotalCents,
  stripProtectedLesson,
  teachingUrlPolicy,
} from "./commerce";

test("once-off and plan prices stay in USD cents", () => {
  assert.equal(FALLBACK_PRODUCT.once_off_amount_cents, 32700);
  assert.equal(FALLBACK_PRODUCT.plan_amount_cents, 6000);
  assert.equal(FALLBACK_PRODUCT.plan_count, 6);
  assert.notEqual(FALLBACK_PRODUCT.plan_amount_cents * FALLBACK_PRODUCT.plan_count, FALLBACK_PRODUCT.once_off_amount_cents);
});

test("preview accounts get an affiliate code before they register", () => {
  assert.equal(referralCodeForUserId("2435cdf0-c68c-4afb-be36-4cde05e6370a"), "JAN27-2435CDF0");
  assert.equal(accountAccessCopy("free_preview", "signup").title, "Free preview — not registered");
  assert.match(accountAccessCopy("free_preview", "signup").body, /not paid or registered/i);
  assert.match(unpaidPreviewReferralNote("free_preview") || "", /stored on this account until you register/i);
  assert.equal(unpaidPreviewReferralNote("full"), null);
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

test("paid students keep stored teaching files without treating every lesson as a preview", () => {
  const paidPaidLesson = teachingUrlPolicy({ entitlement: "full", isPreviewLesson: false });
  assert.equal(paidPaidLesson.canReadBody, true);
  assert.equal(paidPaidLesson.preview, false);
  assert.equal(paidPaidLesson.keepStoredTeachingUrls, true);

  const paidPreviewLesson = teachingUrlPolicy({ entitlement: "full", isPreviewLesson: true });
  assert.equal(paidPreviewLesson.preview, true);
  assert.equal(paidPreviewLesson.keepStoredTeachingUrls, true);

  const previewPaidLesson = teachingUrlPolicy({ entitlement: "free_preview", isPreviewLesson: false });
  assert.equal(previewPaidLesson.canReadBody, false);
  assert.equal(previewPaidLesson.keepStoredTeachingUrls, false);

  const staff = teachingUrlPolicy({ entitlement: "staff", isPreviewLesson: true });
  assert.equal(staff.keepStoredTeachingUrls, true);

  const closed = teachingUrlPolicy({ entitlement: "none", isPreviewLesson: true });
  assert.equal(closed.canReadBody, false);
  assert.equal(closed.preview, false);
  assert.equal(closed.keepStoredTeachingUrls, false);
  assert.equal(accountAccessCopy("none").title, "Course access ended");
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
