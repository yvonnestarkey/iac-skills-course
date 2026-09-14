import { getSupabase } from "./supabase";

export const ONBOARDING_COUNTRIES = ["South Africa", "Zimbabwe", "Namibia"] as const;
export const ONBOARDING_PHONE_CODES = [
  { code: "+27", label: "South Africa (+27)" },
  { code: "+263", label: "Zimbabwe (+263)" },
  { code: "+264", label: "Namibia (+264)" },
] as const;
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
  iac_attempt_count: number;
  country: OnboardingCountry;
  cta_institution: string;
  cta_year_passed: number;
  cta_attempts: number;
}

export interface OnboardingNotes {
  struggling_areas: string;
  coaching_hopes: string;
  additional_notes: string;
}

export interface OnboardingInput {
  phone: string;
  accountability_email: string;
  demographics: OnboardingDemographics;
  qualitative_notes: OnboardingNotes;
}

function tableMissing(message: string): boolean {
  return /student_profiles/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function columnMissing(message: string, column: string): boolean {
  return new RegExp(column, "i").test(message) && /does not exist|schema cache|could not find/i.test(message);
}

export function formatPhone(code: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  return `${code}${digits}`;
}

export async function fetchOnboardingState(
  userId: string
): Promise<{ completed: boolean; skipped: boolean; available: boolean }> {
  const client = getSupabase();
  if (!client) return { completed: true, skipped: false, available: false };

  const withSkip = await client
    .from("student_profiles")
    .select("onboarding_completed, onboarding_skipped")
    .eq("id", userId)
    .maybeSingle();

  if (withSkip.error && (tableMissing(withSkip.error.message) || columnMissing(withSkip.error.message, "onboarding_skipped"))) {
    if (tableMissing(withSkip.error.message)) return { completed: false, skipped: false, available: false };
    const fallback = await client
      .from("student_profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error) return { completed: false, skipped: false, available: !tableMissing(fallback.error.message) };
    return { completed: Boolean(fallback.data?.onboarding_completed), skipped: false, available: true };
  }

  if (withSkip.error) return { completed: false, skipped: false, available: !tableMissing(withSkip.error.message) };
  return {
    completed: Boolean(withSkip.data?.onboarding_completed),
    skipped: Boolean(withSkip.data?.onboarding_skipped),
    available: true,
  };
}

/** True when the student may enter `/student` routes. */
export async function fetchOnboardingCompleted(userId: string): Promise<boolean> {
  const state = await fetchOnboardingState(userId);
  if (!state.available) return true;
  return state.completed || state.skipped;
}

export async function skipOnboarding(userId: string): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const now = new Date().toISOString();
  const { data: existing } = await client.from("student_profiles").select("id").eq("id", userId).maybeSingle();
  const error = existing
    ? (
        await client
          .from("student_profiles")
          .update({ onboarding_skipped: true, onboarding_completed: false, updated_at: now })
          .eq("id", userId)
      ).error
    : (
        await client.from("student_profiles").insert({
          id: userId,
          onboarding_skipped: true,
          onboarding_completed: false,
          updated_at: now,
        })
      ).error;

  if (error) {
    if (tableMissing(error.message) || columnMissing(error.message, "onboarding_skipped")) {
      return { ok: false, error: "Run supabase/onboarding.sql in the Supabase SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Clear a one-session skip so the next login asks again. */
export async function clearOnboardingSkip(userId: string): Promise<void> {
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
  return { ok: true };
}
