import { getSupabase } from "./supabase";

export const ONBOARDING_COUNTRIES = ["South Africa", "Zimbabwe", "Namibia"] as const;
export const ONBOARDING_INSTITUTIONS = [
  "UNISA",
  "Milpark",
  "UCT",
  "Stellenbosch",
  "NWU",
  "UJ",
  "UKZN",
  "Other",
] as const;
export const ONBOARDING_CTA_YEARS = [2026, 2025, 2024, 2023, 2022] as const;

export type OnboardingCountry = (typeof ONBOARDING_COUNTRIES)[number];
export type OnboardingInstitution = (typeof ONBOARDING_INSTITUTIONS)[number];

export interface OnboardingDemographics {
  iac_written_exam_before: boolean;
  iac_attempt_count: number | null;
  country: OnboardingCountry | null;
  cta_institution: string | null;
  cta_year_passed: number | null;
  cta_attempts: number | null;
}

export interface OnboardingNotes {
  struggling_areas: string;
  coaching_hopes: string;
  additional_notes: string;
}

export interface OnboardingInput {
  phone: string | null;
  accountability_email: string | null;
  demographics: OnboardingDemographics;
  qualitative_notes: OnboardingNotes;
}

export const ONBOARDING_SKIP_COOKIE = "onboarding_skipped_session";

function skipStorageKey(userId: string): string {
  return `${ONBOARDING_SKIP_COOKIE}:${userId}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!match) return null;
  return decodeURIComponent(match.slice(prefix.length));
}

/** True when this browser session skipped onboarding for this student. Does not survive login or a new browser session. */
export function hasOnboardingSessionSkip(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(skipStorageKey(userId)) === "true") return true;
  } catch {
    // Private mode can block sessionStorage; the session cookie is enough.
  }
  return readCookie(ONBOARDING_SKIP_COOKIE) === userId;
}

export function setOnboardingSessionSkip(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(skipStorageKey(userId), "true");
  } catch {
    // Cookie still covers same-tab refresh and other tabs in this browser session.
  }
  document.cookie = `${ONBOARDING_SKIP_COOKIE}=${encodeURIComponent(userId)}; Path=/; SameSite=Lax`;
}

export function clearOnboardingSessionSkip(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      sessionStorage.removeItem(skipStorageKey(userId));
    } else {
      const keys: string[] = [];
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(`${ONBOARDING_SKIP_COOKIE}:`)) keys.push(key);
      }
      keys.forEach((key) => sessionStorage.removeItem(key));
    }
  } catch {
    // Ignore storage access errors.
  }
  document.cookie = `${ONBOARDING_SKIP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function tableMissing(message: string): boolean {
  return /student_profiles/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

export async function fetchOnboardingState(
  userId: string
): Promise<{ completed: boolean; skipped: boolean; available: boolean }> {
  const client = getSupabase();
  if (!client) return { completed: true, skipped: false, available: false };

  const result = await client.from("student_profiles").select("onboarding_completed").eq("id", userId).maybeSingle();

  if (result.error) {
    return { completed: false, skipped: false, available: !tableMissing(result.error.message) };
  }

  return {
    completed: Boolean(result.data?.onboarding_completed),
    skipped: hasOnboardingSessionSkip(userId),
    available: true,
  };
}

/** True when the student may enter `/student` routes for this browser session. */
export async function fetchOnboardingCompleted(userId: string): Promise<boolean> {
  const state = await fetchOnboardingState(userId);
  if (!state.available || state.completed) return true;
  return hasOnboardingSessionSkip(userId);
}

/** Incomplete profiles must complete onboarding unless they skipped in this browser session. */
export function isOnboardingRequired(state: { completed: boolean; available: boolean }, userId: string): boolean {
  if (!state.available || state.completed) return false;
  return !hasOnboardingSessionSkip(userId);
}

/** Skip only for this browser session. Never store a permanent DB bypass. */
export async function skipOnboarding(userId: string): Promise<{ ok: boolean; error?: string }> {
  setOnboardingSessionSkip(userId);
  return { ok: true };
}

/** Drop the session skip (and any leftover DB flag) so the next login asks again. */
export async function clearOnboardingSkip(userId: string): Promise<void> {
  clearOnboardingSessionSkip(userId);
  const client = getSupabase();
  if (!client) return;
  await client
    .from("student_profiles")
    .update({ onboarding_skipped: false, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("onboarding_completed", false);
}

export async function saveOnboarding(
  userId: string,
  input: OnboardingInput
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const { error: profileError } = await client
    .from("profiles")
    .update({
      phone: input.phone,
      accountability_email: input.accountability_email,
    })
    .eq("id", userId);
  if (profileError) return { ok: false, error: profileError.message };

  const { error: rowError } = await client.from("student_profiles").upsert({
    id: userId,
    demographics: input.demographics,
    qualitative_notes: input.qualitative_notes,
    onboarding_completed: true,
    onboarding_skipped: false,
    updated_at: new Date().toISOString(),
  });
  if (rowError) {
    if (tableMissing(rowError.message)) {
      return { ok: false, error: "Run supabase/onboarding.sql in the Supabase SQL editor first." };
    }
    return { ok: false, error: rowError.message };
  }
  clearOnboardingSessionSkip(userId);
  return { ok: true };
}
