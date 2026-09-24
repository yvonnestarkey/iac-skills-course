import type { PurchaseOption } from "@/lib/commerce";

export const SMOKE_TEST_AMOUNT_CENTS = 100;
export const SMOKE_TEST_METADATA_VALUE = "true";

export function readSmokeTestPriceId(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.STRIPE_PRICE_SMOKE_TEST?.trim();
  return value || null;
}

export type SmokeTestResolution =
  | { ok: true; smokeTest: false }
  | { ok: true; smokeTest: true; priceId: string }
  | { ok: false; status: 400 | 403 | 503; error: string };

export function resolveCheckoutSmokeTest(params: {
  smokeTestRequested: boolean;
  option: PurchaseOption;
  isStaff: boolean;
  smokeTestPriceId: string | null;
}): SmokeTestResolution {
  if (!params.smokeTestRequested) return { ok: true, smokeTest: false };
  if (params.option !== "once_off") {
    return { ok: false, status: 400, error: "Smoke test is only available for a once-off payment." };
  }
  if (!params.isStaff) {
    return { ok: false, status: 403, error: "Smoke test is limited to staff accounts." };
  }
  if (!params.smokeTestPriceId) {
    return { ok: false, status: 503, error: "Smoke-test price is not configured." };
  }
  return { ok: true, smokeTest: true, priceId: params.smokeTestPriceId };
}

export function onceOffPriceIdForCheckout(params: {
  smokeTest: boolean;
  onceOffPriceId: string | null;
  smokeTestPriceId: string | null;
}): string | null {
  return params.smokeTest ? params.smokeTestPriceId : params.onceOffPriceId;
}

export function checkoutSmokeTestMetadata(smokeTest: boolean): Record<string, string> {
  return smokeTest ? { smoke_test: SMOKE_TEST_METADATA_VALUE } : {};
}
