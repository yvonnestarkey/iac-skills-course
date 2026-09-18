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

export type VolumeDiagnosticKind = "volume_deficit" | "accuracy_deficit" | "none";

export const VOLUME_DEFICIT_MESSAGE =
  "Volume Deficit: High point accuracy, but you attempted fewer points than the total marks available. Work on expanding breadth/depth to reach full mark potential.";

export const ACCURACY_DEFICIT_MESSAGE =
  "Accuracy Deficit: You generated sufficient point volume, but accuracy per point was low. Focus on precise, scenario-locked technical statements.";

export type VolumeAccuracyEntry = {
  id?: string;
  user_id: string;
  paper_name: string;
  question_code: string;
  minutes_allowed: number;
  minutes_used: number;
  total_marks: number;
  points_attempted: number;
  marks_earned: number;
  notes: string;
  created_at?: string;
  volume_pct: number;
  accuracy_pct: number;
  score_conversion_pct: number;
  time_pct: number;
  diagnostic_kind: VolumeDiagnosticKind;
  diagnostic: string;
};

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function pctOf(earned: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.round((earned / available) * 1000) / 10);
}

export function classifyVolumeDiagnostic(volumePct: number, accuracyPct: number): {
  kind: VolumeDiagnosticKind;
  message: string;
} {
  if (volumePct < 100 && accuracyPct >= 65) {
    return { kind: "volume_deficit", message: VOLUME_DEFICIT_MESSAGE };
  }
  if (volumePct >= 100 && accuracyPct < 50) {
    return { kind: "accuracy_deficit", message: ACCURACY_DEFICIT_MESSAGE };
  }
  return { kind: "none", message: "" };
}

export function volumeRatios(pointsAttempted: number, totalMarks: number, marksEarned: number) {
  const volume_pct = pctOf(pointsAttempted, totalMarks);
  const accuracy_pct = pctOf(marksEarned, pointsAttempted);
  const score_conversion_pct = pctOf(marksEarned, totalMarks);
  const diagnostic = classifyVolumeDiagnostic(volume_pct, accuracy_pct);
  return { volume_pct, accuracy_pct, score_conversion_pct, ...diagnostic };
}

export function entryFromRow(row: Record<string, unknown>): VolumeAccuracyEntry {
  const minutes_allowed = asNumber(row.minutes_allowed);
  const minutes_used = asNumber(row.minutes_used);
  const total_marks = asNumber(row.marks_available) || asNumber(row.questions_available);
  const points_attempted = asNumber(row.questions_completed);
  const marks_earned = asNumber(row.marks_earned);
  const paper_name = String(row.paper_name || "");
  const ratios = volumeRatios(points_attempted, total_marks, marks_earned);
  return {
    id: row.id ? String(row.id) : undefined,
    user_id: String(row.user_id || ""),
    paper_name,
    question_code: paper_name.split(" · ")[0] || paper_name,
    minutes_allowed,
    minutes_used,
    total_marks,
    points_attempted,
    marks_earned,
    notes: String(row.notes || ""),
    created_at: row.created_at ? String(row.created_at) : undefined,
    volume_pct: ratios.volume_pct,
    accuracy_pct: ratios.accuracy_pct,
    score_conversion_pct: ratios.score_conversion_pct,
    time_pct: pctOf(minutes_used, minutes_allowed),
    diagnostic_kind: ratios.kind,
    diagnostic: ratios.message,
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
  question_code: string;
  total_marks: number;
  points_attempted: number;
  marks_earned: number;
  notes: string;
}): Promise<{ ok: true; entry: VolumeAccuracyEntry } | { ok: false; error: string }> {
  const { getSupabase } = await import("./supabase");
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const paperName = input.paper_name || input.question_code;
  const { data, error } = await supabase
    .from("volume_accuracy_entries")
    .insert({
      user_id: input.userId,
      paper_name: paperName,
      minutes_allowed: 0,
      minutes_used: 0,
      questions_available: input.total_marks,
      questions_completed: input.points_attempted,
      marks_available: input.total_marks,
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
  if (!entry) return "Latest Volume vs Accuracy: none saved yet.";
  return [
    `Latest Volume vs Accuracy (${entry.created_at || "undated"} · ${entry.paper_name || "unspecified section"}):`,
    `- Question Code: ${entry.question_code || "not recorded"}`,
    `- Total Marks: ${entry.total_marks} (official section allocation — do not call this Available Marks)`,
    `- Points Attempted: ${entry.points_attempted}`,
    `- Marks Earned: ${entry.marks_earned}`,
    `- Volume Ratio: ${entry.volume_pct}% = (Points Attempted / Total Marks) * 100`,
    `- Accuracy Ratio: ${entry.accuracy_pct}% = (Marks Earned / Points Attempted) * 100`,
    `- Score Conversion: ${entry.score_conversion_pct}% = (Marks Earned / Total Marks) * 100`,
    entry.diagnostic ? `- Diagnostic: ${entry.diagnostic}` : "- Diagnostic: neither volume deficit nor accuracy deficit thresholds were met.",
    entry.notes ? `- Notes: ${entry.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
