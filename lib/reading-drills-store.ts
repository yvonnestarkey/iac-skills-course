"use client";

import { getSupabase } from "@/lib/supabase";
import type { DrillAttempt, ReadingCheckResult } from "@/lib/reading-drills";

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
  const { error } = await db.from("reading_attempts").insert({ user_id: userId, ...attempt });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function saveReadingCheck(userId: string, result: ReadingCheckResult): Promise<{ ok: boolean; error?: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "The course database is not connected." };
  const { error } = await db.from("reading_checks").insert({ user_id: userId, ...result });
  return error ? { ok: false, error: error.message } : { ok: true };
}
