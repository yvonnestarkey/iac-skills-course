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

export type VolumeDiagnosticKind = "volume_deficit" | "accuracy_deficit" | "optimal" | "calculation" | "none";

export const VOLUME_DEFICIT_TAG = "Volume Deficit";
export const ACCURACY_DEFICIT_TAG = "Accuracy Deficit";
export const OPTIMAL_TAG = "Optimal";
export const CALCULATION_TAG = "N/A - Calculation";

export const VOLUME_DEFICIT_MESSAGE =
  "Volume Deficit: High point accuracy, but you attempted fewer points than the total marks available. Work on expanding breadth/depth to reach full mark potential.";

export const ACCURACY_DEFICIT_MESSAGE =
  "Accuracy Deficit: You generated sufficient point volume, but accuracy per point was low. Focus on precise, scenario-locked technical statements.";

export type VolumeAccuracyEntry = {
  id?: string;
  user_id: string;
  session_id: string;
  paper_code: string;
  paper_name: string;
  question_code: string;
  isCalculation: boolean;
  minutes_allowed: number;
  minutes_used: number;
  total_marks: number;
  points_wrote: number;
  marks_got: number;
  notes: string;
  created_at?: string;
  volume_pct: number | null;
  accuracy_pct: number | null;
  score_conversion_pct: number;
  diagnostic_kind: VolumeDiagnosticKind;
  diagnostic: string;
};

export type VolumePaperSession = {
  session_id: string;
  paper_code: string;
  paper_name: string;
  created_at?: string;
  questions: VolumeAccuracyEntry[];
};

export type VolumeRowInput = {
  question_code: string;
  title: string;
  total_marks: number;
  isCalculation: boolean;
  points_wrote: number;
  marks_got: number;
};

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function pctOf(earned: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.round((earned / available) * 1000) / 10);
}

export function diagnosticTag(kind: VolumeDiagnosticKind): string {
  if (kind === "volume_deficit") return VOLUME_DEFICIT_TAG;
  if (kind === "accuracy_deficit") return ACCURACY_DEFICIT_TAG;
  if (kind === "optimal") return OPTIMAL_TAG;
  if (kind === "calculation") return CALCULATION_TAG;
  return "";
}

export function classifyVolumeDiagnostic(
  volumePct: number,
  accuracyPct: number,
  isCalculation = false
): { kind: VolumeDiagnosticKind; message: string } {
  if (isCalculation) {
    return { kind: "calculation", message: CALCULATION_TAG };
  }
  if (volumePct < 100 && accuracyPct >= 65) {
    return { kind: "volume_deficit", message: VOLUME_DEFICIT_MESSAGE };
  }
  if (volumePct >= 100 && accuracyPct < 50) {
    return { kind: "accuracy_deficit", message: ACCURACY_DEFICIT_MESSAGE };
  }
  return { kind: "optimal", message: OPTIMAL_TAG };
}

export function volumeRatios(
  pointsWrote: number,
  totalMarks: number,
  marksGot: number,
  isCalculation = false
) {
  if (isCalculation) {
    return {
      volume_pct: null as number | null,
      accuracy_pct: null as number | null,
      score_conversion_pct: pctOf(marksGot, totalMarks),
      kind: "calculation" as VolumeDiagnosticKind,
      message: CALCULATION_TAG,
    };
  }
  const volume_pct = pctOf(pointsWrote, totalMarks);
  const accuracy_pct = pctOf(marksGot, pointsWrote);
  const score_conversion_pct = pctOf(marksGot, totalMarks);
  const diagnostic = classifyVolumeDiagnostic(volume_pct, accuracy_pct, false);
  return { volume_pct, accuracy_pct, score_conversion_pct, ...diagnostic };
}

function encodeVolumeNotes(meta: {
  session_id: string;
  paper_code: string;
  question_code: string;
  isCalculation: boolean;
}): string {
  return `session:${meta.session_id}|paper:${meta.paper_code}|q:${meta.question_code}|calc:${meta.isCalculation ? "1" : "0"}`;
}

function parseVolumeNotes(notes: string): {
  session_id: string;
  paper_code: string;
  question_code: string;
  isCalculation: boolean;
} {
  return {
    session_id: /session:([^|]+)/.exec(notes)?.[1] || "",
    paper_code: /paper:([^|]+)/.exec(notes)?.[1] || "",
    question_code: /q:([^|]+)/.exec(notes)?.[1] || "",
    isCalculation: /calc:1/.test(notes),
  };
}

function formatPctLabel(value: number | null): string {
  return value == null ? "N/A" : `${value}%`;
}

export function entryFromRow(row: Record<string, unknown>): VolumeAccuracyEntry {
  const notes = String(row.notes || "");
  const meta = parseVolumeNotes(notes);
  const paper_name = String(row.paper_name || "");
  const total_marks = asNumber(row.marks_available) || asNumber(row.questions_available);
  const points_wrote = asNumber(row.questions_completed);
  const marks_got = asNumber(row.marks_earned);
  const isCalculation = meta.isCalculation;
  const ratios = volumeRatios(points_wrote, total_marks, marks_got, isCalculation);
  const question_code = meta.question_code || paper_name.split(" · ")[0] || paper_name;
  return {
    id: row.id ? String(row.id) : undefined,
    user_id: String(row.user_id || ""),
    session_id: meta.session_id || (row.id ? String(row.id) : ""),
    paper_code: meta.paper_code,
    paper_name,
    question_code,
    isCalculation,
    minutes_allowed: asNumber(row.minutes_allowed),
    minutes_used: asNumber(row.minutes_used),
    total_marks,
    points_wrote,
    marks_got,
    notes,
    created_at: row.created_at ? String(row.created_at) : undefined,
    volume_pct: ratios.volume_pct,
    accuracy_pct: ratios.accuracy_pct,
    score_conversion_pct: ratios.score_conversion_pct,
    diagnostic_kind: ratios.kind,
    diagnostic: ratios.message,
  };
}

function sessionFromEntries(entries: VolumeAccuracyEntry[]): VolumePaperSession | null {
  if (!entries.length) return null;
  const first = entries[0];
  return {
    session_id: first.session_id,
    paper_code: first.paper_code,
    paper_name: first.paper_name.split(" · ").slice(0, 1).join(" · ") || first.paper_name,
    created_at: first.created_at,
    questions: entries,
  };
}

function groupSessions(entries: VolumeAccuracyEntry[]): VolumePaperSession[] {
  const grouped = new Map<string, VolumeAccuracyEntry[]>();
  for (const entry of entries) {
    const key = entry.session_id || entry.id || `${entry.created_at}-${entry.question_code}`;
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  }
  return [...grouped.values()]
    .map((rows) => sessionFromEntries(rows))
    .filter((session): session is VolumePaperSession => Boolean(session));
}

async function fetchVolumeRows(supabase: SupabaseClient, userId: string, limit = 80): Promise<VolumeAccuracyEntry[]> {
  const { data, error } = await supabase
    .from("volume_accuracy_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => entryFromRow(row as Record<string, unknown>));
}

export async function fetchLatestVolumeAccuracy(
  supabase: SupabaseClient,
  userId: string
): Promise<VolumePaperSession | null> {
  const rows = await fetchVolumeRows(supabase, userId);
  return groupSessions(rows)[0] || null;
}

export async function fetchOwnVolumeSessions(userId: string): Promise<VolumePaperSession[]> {
  const { getSupabase } = await import("./supabase");
  const supabase = getSupabase();
  if (!supabase || !userId) return [];
  const rows = await fetchVolumeRows(supabase, userId);
  return groupSessions(rows).slice(0, 6);
}

export async function saveVolumePaperSession(input: {
  userId: string;
  paper_code: string;
  paper_name: string;
  rows: VolumeRowInput[];
}): Promise<{ ok: true; session: VolumePaperSession } | { ok: false; error: string }> {
  const { getSupabase } = await import("./supabase");
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const session_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = input.rows.map((row) => ({
    user_id: input.userId,
    paper_name: `${input.paper_code} · ${row.question_code} · ${row.title}`,
    minutes_allowed: 0,
    minutes_used: 0,
    questions_available: row.total_marks,
    questions_completed: row.isCalculation ? 0 : row.points_wrote,
    marks_available: row.total_marks,
    marks_earned: row.marks_got,
    notes: encodeVolumeNotes({
      session_id,
      paper_code: input.paper_code,
      question_code: row.question_code,
      isCalculation: row.isCalculation,
    }),
  }));
  const { data, error } = await supabase.from("volume_accuracy_entries").insert(payload).select("*");
  if (error) {
    if (/volume_accuracy_entries|schema cache|does not exist/i.test(error.message)) {
      return { ok: false, error: "Could not save. Paste supabase/volume_accuracy.sql in the SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  const session = sessionFromEntries((data || []).map((row) => entryFromRow(row as Record<string, unknown>)));
  if (!session) return { ok: false, error: "Could not save that paper session." };
  return { ok: true, session: { ...session, paper_code: input.paper_code, paper_name: input.paper_name } };
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

export function formatVolumeContext(session: VolumePaperSession | null): string {
  if (!session?.questions.length) return "Latest Volume vs Accuracy: none saved yet.";
  const discussion = session.questions.filter((row) => !row.isCalculation);
  const volumeAvg =
    discussion.length && discussion.every((row) => row.volume_pct != null)
      ? Math.round((discussion.reduce((sum, row) => sum + (row.volume_pct || 0), 0) / discussion.length) * 10) / 10
      : null;
  const accuracyAvg =
    discussion.length && discussion.every((row) => row.accuracy_pct != null)
      ? Math.round((discussion.reduce((sum, row) => sum + (row.accuracy_pct || 0), 0) / discussion.length) * 10) / 10
      : null;
  const lines = session.questions.map((row) => {
    const points = row.isCalculation ? "N/A" : String(row.points_wrote);
    return `- ${row.question_code}: Total Marks ${row.total_marks}; Points Wrote ${points}; Marks You Got ${row.marks_got}; Volume ${formatPctLabel(row.volume_pct)}; Accuracy ${formatPctLabel(row.accuracy_pct)}; ${diagnosticTag(row.diagnostic_kind) || row.diagnostic}`;
  });
  return [
    `Latest Volume vs Accuracy (${session.created_at || "undated"} · ${session.paper_name || session.paper_code || "unspecified paper"}):`,
    `- Use Total Marks, Points Wrote, and Marks You Got. Calculation/disclosure sections are N/A for volume so they do not skew ratios.`,
    volumeAvg != null ? `- Discussion Volume Ratio average: ${volumeAvg}%` : "",
    accuracyAvg != null ? `- Discussion Accuracy Ratio average: ${accuracyAvg}%` : "",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}
