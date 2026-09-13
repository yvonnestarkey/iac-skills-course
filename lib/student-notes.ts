import { getSupabase } from "./supabase";

function cacheKey(userId: string): string {
  return `asa-student-notes:${userId}`;
}

function readCache(userId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(cacheKey(userId)) || "";
  } catch {
    return "";
  }
}

function writeCache(userId: string, body: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(userId), body);
  } catch {
    /* ignore quota / private mode */
  }
}

export async function fetchStudentNotes(userId: string): Promise<{ ok: boolean; error?: string; body: string }> {
  const cached = readCache(userId);
  const client = getSupabase();
  if (!client) return { ok: true, body: cached };

  const { data, error } = await client.from("student_notes").select("body").eq("user_id", userId).maybeSingle();
  if (error) {
    if (cached) return { ok: true, body: cached };
    return { ok: false, error: error.message, body: "" };
  }
  const body = data?.body || cached || "";
  if (body) writeCache(userId, body);
  return { ok: true, body };
}

export async function saveStudentNotes(userId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  writeCache(userId, body);
  const client = getSupabase();
  if (!client) return { ok: true };

  const { error } = await client.from("student_notes").upsert({
    user_id: userId,
    body,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
