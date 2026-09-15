import { ensureStudentProfile } from "./profiles";
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

function logSupabaseError(scope: string, error: { message: string; details?: string | null; hint?: string | null; code?: string }) {
  console.error(error.message);
  console.error(`[onboarding] ${scope}`, error.message, error.code || "", error.details || "", error.hint || "");
}

export async function fetchOnboardingState(
  userId: string
): Promise<{ completed: boolean; skipped: boolean; available: boolean }> {
  const client = getSupabase();
  if (!client) return { completed: true, skipped: false, available: false };

  const result = await client
    .from("student_profiles")
    .select("onboarding_completed, onboarding_skipped")
    .eq("student_id", userId)
    .maybeSingle();

  if (result.error) {
    logSupabaseError("fetchOnboardingState", result.error);
    return { completed: false, skipped: false, available: !tableMissing(result.error.message) };
  }

  return {
    completed: result.data?.onboarding_completed === true,
    skipped: result.data?.onboarding_skipped === true,
    available: true,
  };
}

/** True when onboarding is finished. Session skip is enforced separately. */
export async function fetchOnboardingCompleted(userId: string): Promise<boolean> {
  const state = await fetchOnboardingState(userId);
  return !state.available || state.completed || state.skipped;
}

export function isOnboardingRequired(state: { completed: boolean; skipped: boolean; available: boolean }): boolean {
  return state.available && !state.completed && !state.skipped;
}

export async function fetchSessionSkip(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const result = await fetch("/api/onboarding/skip", { credentials: "same-origin" });
    if (!result.ok) return false;
    const body = (await result.json()) as { skipped?: boolean };
    return body.skipped === true;
  } catch {
    return false;
  }
}

/** Profile completed, skipped this browser session, or onboarding table missing. */
export async function fetchOnboardingGate(userId: string): Promise<"needed" | "done"> {
  const [state, skipped] = await Promise.all([fetchOnboardingState(userId), fetchSessionSkip()]);
  if (skipped || !isOnboardingRequired(state)) return "done";
  return "needed";
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
  const { error } = await client
    .from("student_profiles")
    .update({ onboarding_skipped: false, updated_at: new Date().toISOString() })
    .eq("student_id", userId)
    .eq("onboarding_completed", false);
  if (error) logSupabaseError("clearOnboardingSkip", error);
}

/** Persist skip so repeat logins are not sent back through the form. */
export async function markOnboardingSkipped(userId: string): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("student_profiles").upsert(
    {
      student_id: userId,
      onboarding_skipped: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" }
  );
  if (error) {
    logSupabaseError("markOnboardingSkipped", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function saveOnboarding(
  userId: string,
  input: OnboardingInput
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) {
    return { ok: false, error: authError?.message || "Sign in required." };
  }

  await ensureStudentProfile({
    id: auth.user.id,
    email: auth.user.email || null,
    user_metadata: auth.user.user_metadata,
  });

  const now = new Date().toISOString();
  const profilePayload = {
    id: auth.user.id,
    email: auth.user.email || "",
    full_name:
      (typeof auth.user.user_metadata?.full_name === "string" && auth.user.user_metadata.full_name.trim()) ||
      auth.user.email ||
      "",
    phone_number: input.phone,
    accountability_email: input.accountability_email,
    updated_at: now,
  };

  let profileWrite = await client.from("profiles").upsert(profilePayload, { onConflict: "id" });
  if (profileWrite.error && /updated_at|could not find|schema cache/i.test(profileWrite.error.message)) {
    const { updated_at: _updated, ...withoutStamp } = profilePayload;
    profileWrite = await client.from("profiles").upsert(withoutStamp, { onConflict: "id" });
  }
  if (profileWrite.error) logSupabaseError("saveOnboarding.profiles", profileWrite.error);

  const payload = {
    student_id: userId,
    demographics: {
      written_before: input.demographics.iac_written_exam_before,
      exam_attempts: input.demographics.iac_attempt_count,
      country: input.demographics.country,
      cta_institution: input.demographics.cta_institution,
      cta_year: input.demographics.cta_year_passed,
      cta_attempts: input.demographics.cta_attempts,
    },
    qualitative_notes: {
      struggle_areas: input.qualitative_notes.struggling_areas,
      coaching_goals: input.qualitative_notes.coaching_hopes,
      additional_notes: input.qualitative_notes.additional_notes,
    },
    onboarding_completed: true,
    onboarding_skipped: false,
    updated_at: now,
  };

  const { error: rowError } = await client.from("student_profiles").upsert(payload, { onConflict: "student_id" });
  if (rowError) {
    logSupabaseError("saveOnboarding.student_profiles", rowError);
    return { ok: false, error: rowError.message };
  }

  const { data: saved, error: checkError } = await client
    .from("student_profiles")
    .select("onboarding_completed")
    .eq("student_id", userId)
    .maybeSingle();
  if (checkError) {
    logSupabaseError("saveOnboarding.verify", checkError);
    return { ok: false, error: checkError.message };
  }
  if (saved?.onboarding_completed !== true) {
    return { ok: false, error: "Onboarding was not marked complete. Try Start the course again." };
  }

  await clearOnboardingSkipCookie();
  return { ok: true };
}
