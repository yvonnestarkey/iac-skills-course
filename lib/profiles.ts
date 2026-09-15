import { isoDate, today } from "./dates";
import { parseRosterOnboarding } from "./roster";
import { isCoachAccount } from "./roles";
import { getSupabase } from "./supabase";
import type { Student } from "./types";
import type { UserProfile } from "../types/database";

export type { UserProfile };
export type ProfileRow = UserProfile & {
  email: string;
  role: string;
  cohort: string;
  created_at: string;
};

function displayName(email: string, fullName?: string | null): string {
  if (fullName && fullName.trim()) return fullName.trim();
  const local = email.split("@")[0] || "Student";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function profileToStudent(
  row: ProfileRow,
  completed: string[] = [],
  extras: Record<string, unknown> = {}
): Student {
  const onboarding = parseRosterOnboarding({ ...row, ...extras });
  return {
    id: row.id,
    name: displayName(row.email, row.full_name || (typeof extras.full_name === "string" ? extras.full_name : null)),
    email: row.email,
    cohort: row.cohort || (typeof extras.cohort === "string" && extras.cohort) || "autumn26",
    status: "active",
    joined: row.created_at ? row.created_at.slice(0, 10) : isoDate(today()),
    lastActive:
      row.last_active ||
      (typeof extras.last_active === "string" ? extras.last_active : null) ||
      (row.created_at ? row.created_at.slice(0, 10) : isoDate(today())),
    phone: asOptionalText(row.phone_number) || asOptionalText(extras.phone_number) || asOptionalText(extras.phone),
    accountabilityEmail: asOptionalText(row.accountability_email) || asOptionalText(extras.accountability_email),
    onboardingCompleted: onboarding.onboardingCompleted,
    onboardingSkipped: onboarding.onboardingSkipped,
    country: onboarding.country,
    ctaUniversity: onboarding.ctaUniversity,
    ctaYear: onboarding.ctaYear,
    iacAttempts: onboarding.iacAttempts,
    repeatStudent: onboarding.repeatStudent,
    coachingGoals: onboarding.coachingGoals,
    struggleAreas: onboarding.struggleAreas,
    completed,
  };
}

function asOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

export async function ensureStudentProfile(user: {
  id: string;
  email: string | null;
  role?: string | null;
  full_name?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  let email = user.email;
  let metadata = user.user_metadata;
  if (!email || !metadata) {
    const { data } = await client.auth.getUser();
    email = email || data.user?.email || null;
    metadata = metadata || data.user?.user_metadata || null;
  }
  if (!email) return;

  const metaName = metadata?.full_name;
  const fullName =
    (typeof metaName === "string" && metaName.trim()) ||
    (user.full_name && user.full_name.trim()) ||
    displayName(email);
  const role = isCoachAccount({ id: user.id, email, role: user.role || null }) ? "coach" : "student";
  const now = new Date().toISOString();
  const identity = {
    id: user.id,
    email,
    full_name: fullName,
    updated_at: now,
    last_active: isoDate(today()),
  };

  const { data: existing } = await client.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (existing) {
    const { error } = await client.from("profiles").update(identity).eq("id", user.id);
    if (error && /updated_at|could not find|schema cache/i.test(error.message)) {
      const { updated_at: _updated, ...withoutStamp } = identity;
      await client.from("profiles").update(withoutStamp).eq("id", user.id);
    } else if (error) {
      console.error(error.message);
    }
    return;
  }

  const insert = { ...identity, role, cohort: "autumn26" };
  const { error } = await client.from("profiles").insert(insert);
  if (error && /updated_at|could not find|schema cache/i.test(error.message)) {
    const { updated_at: _updated, ...withoutStamp } = insert;
    await client.from("profiles").insert(withoutStamp);
  } else if (error) {
    console.error(error.message);
  }
}

export async function fetchStudentProfiles(): Promise<{ ok: boolean; error?: string; data: ProfileRow[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, data: [] };
  return { ok: true, data: (data || []) as ProfileRow[] };
}

export async function fetchCompletedByUser(): Promise<Record<string, string[]>> {
  const client = getSupabase();
  if (!client) return {};
  const { data } = await client.from("lesson_progress").select("user_id, lesson_id").eq("completed", true);
  const map: Record<string, string[]> = {};
  (data || []).forEach((row) => {
    map[row.user_id] = map[row.user_id] || [];
    map[row.user_id].push(row.lesson_id);
  });
  return map;
}

export async function fetchOnboardingByUser(): Promise<Record<string, Record<string, unknown>>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client
    .from("student_profiles")
    .select("student_id, onboarding_completed, onboarding_skipped, demographics, qualitative_notes");
  if (error) {
    if (!/does not exist|schema cache|could not find/i.test(error.message)) console.error(error.message);
    return {};
  }
  const map: Record<string, Record<string, unknown>> = {};
  (data || []).forEach((row) => {
    map[String(row.student_id)] = row as Record<string, unknown>;
  });
  return map;
}

function viewRowToProfile(row: Record<string, unknown>): ProfileRow {
  const email = typeof row.email === "string" ? row.email : "";
  return {
    id: String(row.id || row.student_id || ""),
    email,
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    role: typeof row.role === "string" ? row.role : "student",
    cohort: typeof row.cohort === "string" ? row.cohort : "autumn26",
    phone_number: typeof row.phone_number === "string" ? row.phone_number : null,
    accountability_email: typeof row.accountability_email === "string" ? row.accountability_email : null,
    last_active: typeof row.last_active === "string" ? row.last_active : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export async function fetchRosterStudents(): Promise<{ ok: boolean; error?: string; students: Student[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", students: [] };
  const completed = await fetchCompletedByUser();
  const view = await client.from("coach_student_roster_view").select("*");
  if (!view.error) {
    return {
      ok: true,
      students: ((view.data || []) as Record<string, unknown>[])
        .map((row) => {
          const profile = viewRowToProfile(row);
          if (!profile.id) return null;
          return profileToStudent(profile, completed[profile.id] || [], row);
        })
        .filter((student): student is Student => Boolean(student)),
    };
  }
  if (!/does not exist|schema cache|could not find/i.test(view.error.message)) {
    console.error("coach_student_roster_view", view.error.message);
  }
  const result = await fetchStudentProfiles();
  if (!result.ok) return { ok: false, error: result.error, students: [] };
  const onboarding = await fetchOnboardingByUser();
  return {
    ok: true,
    students: result.data.map((row) => profileToStudent(row, completed[row.id] || [], onboarding[row.id] || {})),
  };
}

export async function fetchRosterStudent(id: string): Promise<Student | null> {
  const client = getSupabase();
  if (!client) return null;
  const view = await client.from("coach_student_roster_view").select("*").eq("id", id).maybeSingle();
  const completed = await fetchCompletedByUser();
  if (!view.error && view.data) {
    const row = view.data as Record<string, unknown>;
    return profileToStudent(viewRowToProfile(row), completed[id] || [], row);
  }
  const { data } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const onboarding = await fetchOnboardingByUser();
  return profileToStudent(data as ProfileRow, completed[id] || [], onboarding[id] || {});
}

/** Registered students first, then demo seed students that are not the same email. */
export function mergeRoster(seed: Student[], live: Student[]): Student[] {
  const emails = new Set(live.map((student) => student.email.toLowerCase()));
  return [...live, ...seed.filter((student) => !emails.has(student.email.toLowerCase()))];
}
