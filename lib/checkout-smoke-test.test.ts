import test from "node:test";
import assert from "node:assert/strict";
import {
  checkoutSmokeTestMetadata,
  onceOffPriceIdForCheckout,
  readSmokeTestPriceId,
  readSmokeTestStudentEmail,
  resolveCheckoutSmokeTest,
  SMOKE_TEST_AMOUNT_CENTS,
  validateSmokeTestStudent,
} from "./checkout-smoke-test";

const LIVE_ONCE_OFF = "price_live_327";
const SMOKE_PRICE = "price_live_smoke";
const STUDENT = { id: "student-1", email: "preview@test.com" };

test("staff are allowed to start a smoke-test once-off for a selected Free Preview student", () => {
  const resolved = resolveCheckoutSmokeTest({
    smokeTestRequested: true,
    option: "once_off",
    isStaff: true,
    smokeTestPriceId: SMOKE_PRICE,
    studentEmail: "  preview@test.com ",
  });
  assert.deepEqual(resolved, {
    ok: true,
    smokeTest: true,
    priceId: SMOKE_PRICE,
    studentEmail: "preview@test.com",
  });
  assert.deepEqual(
    validateSmokeTestStudent({ found: STUDENT, isStaff: false, entitlement: "free_preview" }),
    { ok: true, userId: STUDENT.id, email: STUDENT.email }
  );
  assert.equal(
    onceOffPriceIdForCheckout({
      smokeTest: true,
      onceOffPriceId: LIVE_ONCE_OFF,
      smokeTestPriceId: SMOKE_PRICE,
    }),
    SMOKE_PRICE
  );
  assert.equal(SMOKE_TEST_AMOUNT_CENTS, 100);
  assert.deepEqual(checkoutSmokeTestMetadata({ smokeTest: true, initiatedBy: "coach-1" }), {
    smoke_test: "true",
    smoke_test_initiated_by: "coach-1",
  });
});

test("staff smoke test without a student email is rejected", () => {
  assert.equal(readSmokeTestStudentEmail(" "), "");
  const resolved = resolveCheckoutSmokeTest({
    smokeTestRequested: true,
    option: "once_off",
    isStaff: true,
    smokeTestPriceId: SMOKE_PRICE,
  });
  assert.deepEqual(resolved, {
    ok: false,
    status: 400,
    error: "Smoke test requires a Free Preview student email.",
  });
});

test("non-staff are rejected even when the smoke-test price and student email exist", () => {
  const resolved = resolveCheckoutSmokeTest({
    smokeTestRequested: true,
    option: "once_off",
    isStaff: false,
    smokeTestPriceId: SMOKE_PRICE,
    studentEmail: STUDENT.email,
  });
  assert.deepEqual(resolved, { ok: false, status: 403, error: "Smoke test is limited to staff accounts." });
});

test("staff smoke test is rejected when STRIPE_PRICE_SMOKE_TEST is missing", () => {
  assert.equal(readSmokeTestPriceId({}), null);
  assert.equal(readSmokeTestPriceId({ STRIPE_PRICE_SMOKE_TEST: "   " }), null);
  const resolved = resolveCheckoutSmokeTest({
    smokeTestRequested: true,
    option: "once_off",
    isStaff: true,
    smokeTestPriceId: readSmokeTestPriceId({}),
    studentEmail: STUDENT.email,
  });
  assert.deepEqual(resolved, { ok: false, status: 503, error: "Smoke-test price is not configured." });
});

test("smoke test cannot target a missing, staff, or already-full student", () => {
  assert.deepEqual(validateSmokeTestStudent({ found: null, isStaff: false, entitlement: "free_preview" }), {
    ok: false,
    status: 400,
    error: "That student was not found.",
  });
  assert.deepEqual(validateSmokeTestStudent({ found: STUDENT, isStaff: true, entitlement: "free_preview" }), {
    ok: false,
    status: 400,
    error: "Smoke test cannot target a staff account.",
  });
  assert.deepEqual(validateSmokeTestStudent({ found: STUDENT, isStaff: false, entitlement: "full" }), {
    ok: false,
    status: 400,
    error: "That student already has full access.",
  });
});

test("normal checkout is unaffected by the smoke-test flag or env", () => {
  assert.deepEqual(
    resolveCheckoutSmokeTest({
      smokeTestRequested: false,
      option: "once_off",
      isStaff: false,
      smokeTestPriceId: SMOKE_PRICE,
      studentEmail: STUDENT.email,
    }),
    { ok: true, smokeTest: false }
  );
  assert.deepEqual(
    resolveCheckoutSmokeTest({
      smokeTestRequested: false,
      option: "plan_6",
      isStaff: true,
      smokeTestPriceId: SMOKE_PRICE,
      studentEmail: STUDENT.email,
    }),
    { ok: true, smokeTest: false }
  );
  assert.equal(
    onceOffPriceIdForCheckout({
      smokeTest: false,
      onceOffPriceId: LIVE_ONCE_OFF,
      smokeTestPriceId: SMOKE_PRICE,
    }),
    LIVE_ONCE_OFF
  );
  assert.deepEqual(checkoutSmokeTestMetadata({ smokeTest: false }), {});
  assert.deepEqual(
    resolveCheckoutSmokeTest({
      smokeTestRequested: true,
      option: "plan_6",
      isStaff: true,
      smokeTestPriceId: SMOKE_PRICE,
      studentEmail: STUDENT.email,
    }),
    { ok: false, status: 400, error: "Smoke test is only available for a once-off payment." }
  );
});
