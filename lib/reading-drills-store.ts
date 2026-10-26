"use client";

import { getSupabase } from "@/lib/supabase";
import { READING_ONCE_COPY, type DrillAttempt, type ReadingCheckResult } from "@/lib/reading-drills";

function alreadyDone(message?: string): boolean {
  return /duplicate|unique|reading_attempts_user_exercise|reading_checks_user_check/i.test(message || "");
}

/** The student's own history, oldest first (RLS limits it to their rows). */
export async function fetchReadingHistory(userId: string): Promise<{ attempts: DrillAttempt[]; checks: ReadingCheckResult[] }> {
  const db = getSupabase();
  if (!db) return { attempts: [], checks: [] };
  const [a, c] = await Promise.all([
    db.from("reading_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(200),
    db.from("reading_checks").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(50),
  ]);
  return {
    attempts: (a.data as DrillAttempt[] | null) || [],
    checks: (c.data as ReadingCheckResult[] | null) || [],
  };
}

export async function saveDrillAttempt(userId: string, attempt: DrillAttempt): Promise<{ ok: boolean; error?: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "The course database is not connected." };
  const existing = await db.from("reading_attempts").select("id").eq("user_id", userId).eq("exercise_id", attempt.exercise_id).maybeSingle();
  if (existing.data) return { ok: false, error: READING_ONCE_COPY };
  const { error } = await db.from("reading_attempts").insert({ user_id: userId, ...attempt });
  if (error && alreadyDone(error.message)) return { ok: false, error: READING_ONCE_COPY };
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function saveReadingCheck(userId: string, result: ReadingCheckResult): Promise<{ ok: boolean; error?: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "The course database is not connected." };
  const existing = await db.from("reading_checks").select("id").eq("user_id", userId).eq("check_id", result.check_id).maybeSingle();
  if (existing.data) return { ok: false, error: READING_ONCE_COPY };
  const { error } = await db.from("reading_checks").insert({ user_id: userId, ...result });
  if (error && alreadyDone(error.message)) return { ok: false, error: READING_ONCE_COPY };
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function listCoachReadingHistory(studentId: string): Promise<{ attempts: DrillAttempt[]; checks: ReadingCheckResult[]; error?: string }> {
  const response = await fetch(`/api/coach/reading?studentId=${encodeURIComponent(studentId)}`, { credentials: "same-origin" });
  const payload = (await response.json().catch(() => null)) as { attempts?: DrillAttempt[]; checks?: ReadingCheckResult[]; error?: string } | null;
  if (!response.ok) return { attempts: [], checks: [], error: payload?.error || "Could not load reading scores." };
  return { attempts: payload?.attempts || [], checks: payload?.checks || [] };
}

export async function resetCoachReadingTask(input: {
  studentId: string;
  kind: "exercise" | "check";
  key: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("/api/coach/reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) return { ok: false, error: payload?.error || "Could not reset that reading task." };
  return { ok: true };
}
