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
    skipped: false,
    available: true,
  };
}

/** True when onboarding is finished. Session skip is enforced in middleware, not here. */
export async function fetchOnboardingCompleted(userId: string): Promise<boolean> {
  const state = await fetchOnboardingState(userId);
  return !state.available || state.completed;
}

export function isOnboardingRequired(state: { completed: boolean; available: boolean }): boolean {
  return state.available && !state.completed;
}

/** Delete the HttpOnly session skip cookie so the next sign-in is gated again. */
export async function clearOnboardingSkipCookie(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/onboarding/skip", { method: "DELETE", credentials: "same-origin" });
  } catch {
    // Sign-out / sign-in should still continue.
  }
}

/** Drop leftover DB skip flags. The live skip is the HttpOnly session cookie. */
export async function clearOnboardingSkip(userId: string): Promise<void> {
  await clearOnboardingSkipCookie();
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
  await clearOnboardingSkipCookie();
  return { ok: true };
}
