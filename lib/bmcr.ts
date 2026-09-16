import { getSupabase } from "./supabase";
import type { BmcrEvaluation } from "../types/database";

export type { BmcrEvaluation };

export type BmcrMarks = Pick<
  BmcrEvaluation,
  | "basic_my_marks"
  | "basic_markplan"
  | "average_my_marks"
  | "average_markplan"
  | "higher_my_marks"
  | "higher_markplan"
  | "question_total_my_marks"
  | "question_total_markplan"
>;

export interface BmcrDiagnostics {
  feels_needs_theory?: boolean | null;
  feelings_reliable?: boolean | null;
}

export type BmcrValue = BmcrMarks & BmcrDiagnostics;

export const BMCR_CHALLENGES = [
  "Procrastination",
  "Self-doubt",
  "Mental Block",
  "Struggled to start on your own",
  "Feel like you don't know enough theory",
] as const;

export const EMPTY_BMCR_MARKS: BmcrMarks = {
  basic_my_marks: 0,
  basic_markplan: 0,
  average_my_marks: 0,
  average_markplan: 0,
  higher_my_marks: 0,
  higher_markplan: 0,
  question_total_my_marks: 0,
  question_total_markplan: 0,
};

export const EMPTY_BMCR_VALUE: BmcrValue = {
  ...EMPTY_BMCR_MARKS,
  feels_needs_theory: null,
  feelings_reliable: null,
};

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["yes", "true", "1"].includes(text)) return true;
    if (["no", "false", "0"].includes(text)) return false;
  }
  return null;
}

export function formatYesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

export function withDiagnostics(value?: Partial<BmcrValue> | null): BmcrValue {
  const marks = withQuestionTotal({
    ...EMPTY_BMCR_MARKS,
    ...(value || {}),
  });
  return {
    ...marks,
    feels_needs_theory: asBool(value?.feels_needs_theory),
    feelings_reliable: asBool(value?.feelings_reliable),
  };
}

export function isPerceptionMismatch(evaluation: Partial<BmcrValue> | null | undefined): boolean {
  const ready = withDiagnostics(evaluation);
  if (ready.feels_needs_theory !== true) return false;
  return computeBmcrPct(ready) < 60 && ready.basic_markplan > 0;
}

export function perceptionMismatchNote(evaluation: Partial<BmcrValue> | null | undefined): string | null {
  const ready = withDiagnostics(evaluation);
  if (ready.feels_needs_theory !== true) return null;
  if (isPerceptionMismatch(ready)) {
    return "Perception vs reality: they still feel they need theory, but BMCR is under 60% — this is a conversion leak, not a theory gap.";
  }
  if (ready.feelings_reliable === false) {
    return "They feel they need theory, and they marked those feelings as not reliable.";
  }
  return null;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function sumMyMarks(marks: Pick<BmcrMarks, "basic_my_marks" | "average_my_marks" | "higher_my_marks">): number {
  return asNumber(marks.basic_my_marks) + asNumber(marks.average_my_marks) + asNumber(marks.higher_my_marks);
}

export function withQuestionTotal(marks: BmcrMarks): BmcrMarks {
  return { ...marks, question_total_my_marks: sumMyMarks(marks) };
}

export function computeBasicMarkPct(marks: Pick<BmcrMarks, "basic_markplan" | "question_total_markplan">): number {
  if (asNumber(marks.question_total_markplan) <= 0) return 0;
  return (asNumber(marks.basic_markplan) / asNumber(marks.question_total_markplan)) * 100;
}

export function computeBmcrPct(marks: Pick<BmcrMarks, "basic_my_marks" | "basic_markplan">): number {
  if (asNumber(marks.basic_markplan) <= 0) return 0;
  return (asNumber(marks.basic_my_marks) / asNumber(marks.basic_markplan)) * 100;
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

export function computeActualMarkPct(marks: Pick<BmcrMarks, "question_total_my_marks" | "question_total_markplan">): number {
  if (asNumber(marks.question_total_markplan) <= 0) return 0;
  return (asNumber(marks.question_total_my_marks) / asNumber(marks.question_total_markplan)) * 100;
}

function formatMarkNumber(value: number): string {
  const rounded = Math.round(asNumber(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatMarksWithPct(earned: number, total: number): string {
  if (asNumber(total) <= 0) return `${formatMarkNumber(earned)} / —`;
  return `${formatMarkNumber(earned)} / ${formatMarkNumber(total)} (${formatPct((asNumber(earned) / asNumber(total)) * 100)})`;
}

export function hasBmcrDiagnostics(value?: Partial<BmcrDiagnostics> | null): boolean {
  return value?.feels_needs_theory != null || value?.feelings_reliable != null;
}

export function hasBmcrData(marks: BmcrMarks): boolean {
  return (
    asNumber(marks.basic_my_marks) > 0 ||
    asNumber(marks.basic_markplan) > 0 ||
    asNumber(marks.average_my_marks) > 0 ||
    asNumber(marks.average_markplan) > 0 ||
    asNumber(marks.higher_my_marks) > 0 ||
    asNumber(marks.higher_markplan) > 0 ||
    asNumber(marks.question_total_markplan) > 0
  );
}

export function bmcrCoachingFeedback(marks: BmcrMarks): { title: string; body: string } | null {
  const ready = withQuestionTotal(marks);
  if (ready.basic_markplan <= 0) return null;
  const converted = computeBmcrPct(ready);
  if (converted >= 80) {
    return {
      title: "Excellent Conversion — Keep It Up!",
      body: `You converted ${formatPct(converted)} of YOUR basic knowledge. This means you're able to get marks for most of what you know, this is great. Keep practicing and make sure that this applies across all your subjects.`,
    };
  }
  if (converted >= 60) {
    return {
      title: "Good Progress — Solid Conversion",
      body: `You converted ${formatPct(converted)} of YOUR basic knowledge. This means that you're getting better at obtaining marks for what you know. Keep practicing so that you're consistently able to use your knowledge.`,
    };
  }
  return {
    title: "Low BMCR — This is not a theory gap",
    body: `You only converted ${formatPct(converted)} of YOUR basic knowledge. This means you're not able to get marks for stuff you already know. There is 'something else' getting in the way of your ability to earn marks.`,
  };
}

export function stringifyBmcrAnswer(value: BmcrMarks | BmcrValue): string {
  const ready = withDiagnostics(value);
  return JSON.stringify({
    ...ready,
    basic_mark_pct: Math.round(computeBasicMarkPct(ready) * 10) / 10,
    bmcr_conversion_pct: Math.round(computeBmcrPct(ready) * 10) / 10,
  });
}

export function parseBmcrAnswer(value: string | undefined | null): BmcrValue {
  const raw = (value || "").trim();
  if (!raw) return { ...EMPTY_BMCR_VALUE };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_BMCR_VALUE };
    return withDiagnostics({
      basic_my_marks: asNumber(parsed.basic_my_marks),
      basic_markplan: asNumber(parsed.basic_markplan),
      average_my_marks: asNumber(parsed.average_my_marks),
      average_markplan: asNumber(parsed.average_markplan),
      higher_my_marks: asNumber(parsed.higher_my_marks),
      higher_markplan: asNumber(parsed.higher_markplan),
      question_total_my_marks: asNumber(parsed.question_total_my_marks),
      question_total_markplan: asNumber(parsed.question_total_markplan),
      feels_needs_theory: asBool(parsed.feels_needs_theory),
      feelings_reliable: asBool(parsed.feelings_reliable),
    });
  } catch {
    return { ...EMPTY_BMCR_VALUE };
  }
}

export function isBmcrAnswer(value: string | undefined | null): boolean {
  const raw = (value || "").trim();
  if (!raw.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed != null && typeof parsed === "object" && "basic_markplan" in parsed && "basic_my_marks" in parsed;
  } catch {
    return false;
  }
}

export function formatBmcrAnswer(value: string | undefined | null): string {
  const marks = parseBmcrAnswer(value);
  if (!hasBmcrData(marks) && !hasBmcrDiagnostics(marks)) return "";
  const parts: string[] = [];
  if (hasBmcrData(marks)) {
    parts.push(
      `BMCR ${formatPct(computeBmcrPct(marks))} · Basic marks ${formatPct(computeBasicMarkPct(marks))} · My ${marks.question_total_my_marks} / Markplan ${marks.question_total_markplan}`
    );
  }
  if (marks.feels_needs_theory != null) parts.push(`Need theory: ${formatYesNo(marks.feels_needs_theory)}`);
  if (marks.feelings_reliable != null) parts.push(`Feelings reliable: ${formatYesNo(marks.feelings_reliable)}`);
  return parts.join(" · ");
}

export function evaluationFromRow(row: Record<string, unknown>): BmcrEvaluation {
  const marks = withQuestionTotal({
    basic_my_marks: asNumber(row.basic_my_marks),
    basic_markplan: asNumber(row.basic_markplan),
    average_my_marks: asNumber(row.average_my_marks),
    average_markplan: asNumber(row.average_markplan),
    higher_my_marks: asNumber(row.higher_my_marks),
    higher_markplan: asNumber(row.higher_markplan),
    question_total_my_marks: asNumber(row.question_total_my_marks),
    question_total_markplan: asNumber(row.question_total_markplan),
  });
  return {
    id: row.id ? String(row.id) : undefined,
    student_id: String(row.student_id || ""),
    assignment_id: String(row.assignment_id || ""),
    ...marks,
    basic_mark_pct: row.basic_mark_pct != null ? asNumber(row.basic_mark_pct) : computeBasicMarkPct(marks),
    bmcr_conversion_pct: row.bmcr_conversion_pct != null ? asNumber(row.bmcr_conversion_pct) : computeBmcrPct(marks),
    challenges: asTextList(row.challenges),
    key_takeaways: String(row.key_takeaways || ""),
    feels_needs_theory: asBool(row.feels_needs_theory),
    feelings_reliable: asBool(row.feelings_reliable),
    submitted_at: row.submitted_at ? String(row.submitted_at) : undefined,
  };
}

export function bmcrAssignmentId(lessonId?: string | null, surveyId?: string | null): string {
  if (lessonId?.trim()) return lessonId.trim();
  if (surveyId?.trim()) return `survey:${surveyId.trim()}`;
  return "";
}

export async function fetchLessonBmcrEvaluation(
  studentId: string,
  assignmentId: string
): Promise<BmcrEvaluation | null> {
  const client = getSupabase();
  if (!client || !studentId || !assignmentId) return null;
  const { data, error } = await client
    .from("assignment_bmcr_evaluations")
    .select("*")
    .eq("student_id", studentId)
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return evaluationFromRow(data as Record<string, unknown>);
}

export async function fetchAllBmcrEvaluations(): Promise<BmcrEvaluation[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("assignment_bmcr_evaluations")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => evaluationFromRow(row as Record<string, unknown>));
}

export type BmcrTier = "low" | "mid" | "high";

export function bmcrTier(pct: number): BmcrTier {
  if (pct >= 80) return "high";
  if (pct >= 60) return "mid";
  return "low";
}

export function averageNumbers(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function fetchStudentBmcrEvaluations(studentId: string): Promise<BmcrEvaluation[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("assignment_bmcr_evaluations")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => evaluationFromRow(row as Record<string, unknown>));
}

function tableMissing(message: string): boolean {
  return /assignment_bmcr_evaluations/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function columnMissing(message: string, column: string): boolean {
  return new RegExp(column, "i").test(message) && /schema cache|could not find|column/i.test(message);
}

export async function saveBmcrEvaluation(input: {
  studentId: string;
  assignmentId: string;
  marks: BmcrMarks | BmcrValue;
  challenges?: string[];
  key_takeaways?: string;
  feels_needs_theory?: boolean | null;
  feelings_reliable?: boolean | null;
  existingId?: string;
}): Promise<{ ok: boolean; error?: string; evaluation?: BmcrEvaluation }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (!input.assignmentId) return { ok: false, error: "Missing assignment id." };
  const supabase = client;

  const existingRow = await fetchLessonBmcrEvaluation(input.studentId, input.assignmentId);
  const value = withDiagnostics({
    ...input.marks,
    feels_needs_theory: input.feels_needs_theory ?? (input.marks as Partial<BmcrValue>).feels_needs_theory,
    feelings_reliable: input.feelings_reliable ?? (input.marks as Partial<BmcrValue>).feelings_reliable,
  });
  const { feels_needs_theory, feelings_reliable, ...marks } = value;
  const row: Record<string, unknown> = {
    student_id: input.studentId,
    assignment_id: input.assignmentId,
    ...marks,
    challenges: input.challenges ?? existingRow?.challenges ?? [],
    key_takeaways: (input.key_takeaways ?? existingRow?.key_takeaways ?? "").trim(),
    feels_needs_theory,
    feelings_reliable,
    submitted_at: new Date().toISOString(),
  };

  const targetId = input.existingId || existingRow?.id;

  async function persist(payload: Record<string, unknown>) {
    const query = targetId
      ? supabase.from("assignment_bmcr_evaluations").update(payload).eq("id", targetId).eq("student_id", input.studentId)
      : supabase.from("assignment_bmcr_evaluations").upsert(payload, { onConflict: "student_id,assignment_id" });
    let { data, error } = await query.select("*").maybeSingle();
    if (error && !targetId) {
      const retry = await supabase.from("assignment_bmcr_evaluations").insert(payload).select("*").maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    return { data, error };
  }

  let { data, error } = await persist(row);
  if (error && (columnMissing(error.message, "feels_needs_theory") || columnMissing(error.message, "feelings_reliable"))) {
    const { feels_needs_theory: _needs, feelings_reliable: _reliable, ...withoutDiagnostics } = row;
    ({ data, error } = await persist(withoutDiagnostics));
  }
  if (error) {
    return {
      ok: false,
      error: tableMissing(error.message)
        ? "Could not save the BMCR. Paste supabase/assignment-bmcr.sql in the SQL editor first."
        : error.message,
    };
  }
  return {
    ok: true,
    evaluation: data
      ? evaluationFromRow({ ...(data as Record<string, unknown>), feels_needs_theory, feelings_reliable })
      : evaluationFromRow({ ...row, id: targetId }),
  };
}
