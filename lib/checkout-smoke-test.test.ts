import test from "node:test";
import assert from "node:assert/strict";
import {
  checkoutSmokeTestMetadata,
  onceOffPriceIdForCheckout,
  readSmokeTestPriceId,
  resolveCheckoutSmokeTest,
  SMOKE_TEST_AMOUNT_CENTS,
} from "./checkout-smoke-test";

const LIVE_ONCE_OFF = "price_live_327";
const SMOKE_PRICE = "price_live_smoke";

test("staff are allowed to start a smoke-test once-off when the env price exists", () => {
  const resolved = resolveCheckoutSmokeTest({
    smokeTestRequested: true,
    option: "once_off",
    isStaff: true,
    smokeTestPriceId: SMOKE_PRICE,
  });
  assert.deepEqual(resolved, { ok: true, smokeTest: true, priceId: SMOKE_PRICE });
  assert.equal(
    onceOffPriceIdForCheckout({
      smokeTest: true,
      onceOffPriceId: LIVE_ONCE_OFF,
      smokeTestPriceId: SMOKE_PRICE,
    }),
    SMOKE_PRICE
  );
  assert.equal(SMOKE_TEST_AMOUNT_CENTS, 100);
  assert.deepEqual(checkoutSmokeTestMetadata(true), { smoke_test: "true" });
});

test("non-staff are rejected even when the smoke-test price exists", () => {
  const resolved = resolveCheckoutSmokeTest({
    smokeTestRequested: true,
    option: "once_off",
    isStaff: false,
    smokeTestPriceId: SMOKE_PRICE,
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
  });
  assert.deepEqual(resolved, { ok: false, status: 503, error: "Smoke-test price is not configured." });
});

test("normal checkout is unaffected by the smoke-test flag or env", () => {
  assert.deepEqual(
    resolveCheckoutSmokeTest({
      smokeTestRequested: false,
      option: "once_off",
      isStaff: false,
      smokeTestPriceId: SMOKE_PRICE,
    }),
    { ok: true, smokeTest: false }
  );
  assert.deepEqual(
    resolveCheckoutSmokeTest({
      smokeTestRequested: false,
      option: "plan_6",
      isStaff: true,
      smokeTestPriceId: SMOKE_PRICE,
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
  assert.deepEqual(checkoutSmokeTestMetadata(false), {});
  assert.deepEqual(
    resolveCheckoutSmokeTest({
      smokeTestRequested: true,
      option: "plan_6",
      isStaff: true,
      smokeTestPriceId: SMOKE_PRICE,
    }),
    { ok: false, status: 400, error: "Smoke test is only available for a once-off payment." }
  );
});
