import type { EntitlementStatus, PurchaseOption } from "@/lib/commerce";

export const SMOKE_TEST_AMOUNT_CENTS = 100;
export const SMOKE_TEST_METADATA_VALUE = "true";

export function readSmokeTestPriceId(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.STRIPE_PRICE_SMOKE_TEST?.trim();
  return value || null;
}

export function readSmokeTestStudentEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || "";
}

export type SmokeTestResolution =
  | { ok: true; smokeTest: false }
  | { ok: true; smokeTest: true; priceId: string; studentEmail: string }
  | { ok: false; status: 400 | 403 | 503; error: string };

export type SmokeTestStudent =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: 400; error: string };

export function resolveCheckoutSmokeTest(params: {
  smokeTestRequested: boolean;
  option: PurchaseOption;
  isStaff: boolean;
  smokeTestPriceId: string | null;
  studentEmail?: string | null;
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
  const studentEmail = readSmokeTestStudentEmail(params.studentEmail);
  if (!studentEmail) {
    return { ok: false, status: 400, error: "Smoke test requires a Free Preview student email." };
  }
  return { ok: true, smokeTest: true, priceId: params.smokeTestPriceId, studentEmail };
}

export function validateSmokeTestStudent(params: {
  found: { id: string; email: string } | null;
  isStaff: boolean;
  entitlement: EntitlementStatus;
}): SmokeTestStudent {
  if (!params.found) {
    return { ok: false, status: 400, error: "That student was not found." };
  }
  if (params.isStaff) {
    return { ok: false, status: 400, error: "Smoke test cannot target a staff account." };
  }
  if (params.entitlement === "full") {
    return { ok: false, status: 400, error: "That student already has full access." };
  }
  return { ok: true, userId: params.found.id, email: params.found.email };
}

export function onceOffPriceIdForCheckout(params: {
  smokeTest: boolean;
  onceOffPriceId: string | null;
  smokeTestPriceId: string | null;
}): string | null {
  return params.smokeTest ? params.smokeTestPriceId : params.onceOffPriceId;
}

export function checkoutSmokeTestMetadata(params: {
  smokeTest: boolean;
  initiatedBy?: string;
}): Record<string, string> {
  if (!params.smokeTest) return {};
  return {
    smoke_test: SMOKE_TEST_METADATA_VALUE,
    ...(params.initiatedBy ? { smoke_test_initiated_by: params.initiatedBy } : {}),
  };
}
