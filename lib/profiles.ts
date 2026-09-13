import { isoDate, today } from "./dates";
import { isCoachAccount } from "./roles";
import { getSupabase } from "./supabase";
import type { Student } from "./types";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  cohort: string;
  last_active: string | null;
  created_at: string;
}

function displayName(email: string, fullName?: string | null): string {
  if (fullName && fullName.trim()) return fullName.trim();
  const local = email.split("@")[0] || "Student";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function profileToStudent(row: ProfileRow, completed: string[] = []): Student {
  return {
    id: row.id,
    name: displayName(row.email, row.full_name),
    email: row.email,
    cohort: row.cohort || "autumn26",
    status: "active",
    joined: row.created_at ? row.created_at.slice(0, 10) : isoDate(today()),
    lastActive: row.last_active || (row.created_at ? row.created_at.slice(0, 10) : isoDate(today())),
    completed,
  };
}

export async function ensureStudentProfile(user: { id: string; email: string | null; role?: string | null }): Promise<void> {
  const client = getSupabase();
  if (!client || !user.email) return;

  const role = isCoachAccount({ id: user.id, email: user.email, role: user.role || null }) ? "coach" : "student";
  const { data: existing } = await client.from("profiles").select("id, role").eq("id", user.id).maybeSingle();

  if (existing) {
    await client
      .from("profiles")
      .update({ email: user.email, last_active: isoDate(today()) })
      .eq("id", user.id);
    return;
  }

  await client.from("profiles").insert({
    id: user.id,
    email: user.email,
    full_name: displayName(user.email),
    role,
    cohort: "autumn26",
    last_active: isoDate(today()),
  });
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

export async function fetchRosterStudents(): Promise<{ ok: boolean; error?: string; students: Student[] }> {
  const result = await fetchStudentProfiles();
  if (!result.ok) return { ok: false, error: result.error, students: [] };
  const completed = await fetchCompletedByUser();
  return {
    ok: true,
    students: result.data.map((row) => profileToStudent(row, completed[row.id] || [])),
  };
}

export async function fetchRosterStudent(id: string): Promise<Student | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const completed = await fetchCompletedByUser();
  return profileToStudent(data as ProfileRow, completed[id] || []);
}

/** Registered students first, then demo seed students that are not the same email. */
export function mergeRoster(seed: Student[], live: Student[]): Student[] {
  const emails = new Set(live.map((student) => student.email.toLowerCase()));
  return [...live, ...seed.filter((student) => !emails.has(student.email.toLowerCase()))];
}
