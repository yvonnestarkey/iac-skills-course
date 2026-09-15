import { isoDate, today } from "./dates";
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
