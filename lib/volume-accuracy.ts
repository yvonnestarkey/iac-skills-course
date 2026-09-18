import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeActualMarkPct,
  computeBasicMarkPct,
  computeBmcrPct,
  evaluationFromRow,
  formatPct,
  perceptionMismatchNote,
  type BmcrEvaluation,
} from "./bmcr";

export type VolumeAccuracyEntry = {
  id?: string;
  user_id: string;
  paper_name: string;
  minutes_allowed: number;
  minutes_used: number;
  questions_available: number;
  questions_completed: number;
  marks_available: number;
  marks_earned: number;
  notes: string;
  created_at?: string;
  volume_pct: number;
  accuracy_pct: number;
  time_pct: number;
};

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function pctOf(earned: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.round((earned / available) * 1000) / 10);
}

export function entryFromRow(row: Record<string, unknown>): VolumeAccuracyEntry {
  const minutes_allowed = asNumber(row.minutes_allowed);
  const minutes_used = asNumber(row.minutes_used);
  const questions_available = asNumber(row.questions_available);
  const questions_completed = asNumber(row.questions_completed);
  const marks_available = asNumber(row.marks_available);
  const marks_earned = asNumber(row.marks_earned);
  return {
    id: row.id ? String(row.id) : undefined,
    user_id: String(row.user_id || ""),
    paper_name: String(row.paper_name || ""),
    minutes_allowed,
    minutes_used,
    questions_available,
    questions_completed,
    marks_available,
    marks_earned,
    notes: String(row.notes || ""),
    created_at: row.created_at ? String(row.created_at) : undefined,
    volume_pct: pctOf(questions_completed, questions_available),
    accuracy_pct: pctOf(marks_earned, marks_available),
    time_pct: pctOf(minutes_used, minutes_allowed),
  };
}

export async function fetchLatestVolumeAccuracy(
  supabase: SupabaseClient,
  userId: string
): Promise<VolumeAccuracyEntry | null> {
  const { data, error } = await supabase
    .from("volume_accuracy_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return entryFromRow(data as Record<string, unknown>);
}

export async function fetchOwnVolumeAccuracy(userId: string): Promise<VolumeAccuracyEntry[]> {
  const { getSupabase } = await import("./supabase");
  const supabase = getSupabase();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("volume_accuracy_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !data) return [];
  return data.map((row) => entryFromRow(row as Record<string, unknown>));
}

export async function saveVolumeAccuracy(input: {
  userId: string;
  paper_name: string;
  minutes_allowed: number;
  minutes_used: number;
  questions_available: number;
  questions_completed: number;
  marks_available: number;
  marks_earned: number;
  notes: string;
}): Promise<{ ok: true; entry: VolumeAccuracyEntry } | { ok: false; error: string }> {
  const { getSupabase } = await import("./supabase");
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await supabase
    .from("volume_accuracy_entries")
    .insert({
      user_id: input.userId,
      paper_name: input.paper_name,
      minutes_allowed: input.minutes_allowed,
      minutes_used: input.minutes_used,
      questions_available: input.questions_available,
      questions_completed: input.questions_completed,
      marks_available: input.marks_available,
      marks_earned: input.marks_earned,
      notes: input.notes,
    })
    .select("*")
    .single();
  if (error) {
    if (/volume_accuracy_entries|schema cache|does not exist/i.test(error.message)) {
      return { ok: false, error: "Could not save. Paste supabase/volume_accuracy.sql in the SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, entry: entryFromRow(data as Record<string, unknown>) };
}

export async function fetchLatestBmcr(
  supabase: SupabaseClient,
  userId: string
): Promise<BmcrEvaluation | null> {
  const { data, error } = await supabase
    .from("assignment_bmcr_evaluations")
    .select("*")
    .eq("student_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return evaluationFromRow(data as Record<string, unknown>);
}

export function formatBmcrContext(evaluation: BmcrEvaluation | null): string {
  if (!evaluation) return "Latest BMCR: none saved yet.";
  const mismatch = perceptionMismatchNote(evaluation);
  return [
    `Latest BMCR (${evaluation.submitted_at || "undated"} · ${evaluation.assignment_id || "standalone"}):`,
    `- Mark capture: my ${evaluation.question_total_my_marks} / markplan ${evaluation.question_total_markplan} (${formatPct(computeActualMarkPct(evaluation))})`,
    `- Basic knowledge available: ${formatPct(computeBasicMarkPct(evaluation))}`,
    `- BMCR conversion of own knowledge: ${formatPct(computeBmcrPct(evaluation))}`,
    `- Basic ${evaluation.basic_my_marks}/${evaluation.basic_markplan}, Average ${evaluation.average_my_marks}/${evaluation.average_markplan}, Higher ${evaluation.higher_my_marks}/${evaluation.higher_markplan}`,
    `- Still feels they need theory: ${evaluation.feels_needs_theory == null ? "not answered" : evaluation.feels_needs_theory ? "yes" : "no"}`,
    mismatch ? `- ${mismatch}` : "",
    evaluation.key_takeaways ? `- Notes: ${evaluation.key_takeaways}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatVolumeContext(entry: VolumeAccuracyEntry | null): string {
  if (!entry) return "Latest Volume/Accuracy: none saved yet.";
  const overTime = entry.minutes_allowed > 0 && entry.minutes_used > entry.minutes_allowed;
  return [
    `Latest Volume/Accuracy (${entry.created_at || "undated"} · ${entry.paper_name || "unspecified paper"}):`,
    `- Time: ${entry.minutes_used} / ${entry.minutes_allowed} minutes (${entry.time_pct}% of allowed${overTime ? ", over time" : ""})`,
    `- Volume: completed ${entry.questions_completed} / ${entry.questions_available} questions (${entry.volume_pct}%)`,
    `- Accuracy: ${entry.marks_earned} / ${entry.marks_available} marks (${entry.accuracy_pct}%)`,
    entry.notes ? `- Notes: ${entry.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
