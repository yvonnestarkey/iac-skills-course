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
  if (ready.question_total_markplan <= 0) return null;
  const available = computeBasicMarkPct(ready);
  const converted = computeBmcrPct(ready);
  if (available >= 50) {
    return {
      title: "You have enough existing knowledge to pass this question!",
      body: `You could have passed this question with your existing knowledge (${formatPct(available)} available basic marks), but you were only able to use ${formatPct(converted)} of what you already know. There is 'something else' (like application, exam technique, or RTFQ) getting in the way of your ability to convert marks — extra theory revision will not fix this on its own.`,
    };
  }
  return {
    title: "Theory gap detected",
    body: `Only ${formatPct(available)} of basic marks were available on this markplan, meaning you'll need to brush up on core theory alongside practicing your conversion technique.`,
  };
}

export function stringifyBmcrAnswer(marks: BmcrMarks): string {
  const ready = withQuestionTotal(marks);
  return JSON.stringify({
    ...ready,
    basic_mark_pct: Math.round(computeBasicMarkPct(ready) * 10) / 10,
    bmcr_conversion_pct: Math.round(computeBmcrPct(ready) * 10) / 10,
  });
}

export function parseBmcrAnswer(value: string | undefined | null): BmcrMarks {
  const raw = (value || "").trim();
  if (!raw) return { ...EMPTY_BMCR_MARKS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_BMCR_MARKS };
    return withQuestionTotal({
      basic_my_marks: asNumber(parsed.basic_my_marks),
      basic_markplan: asNumber(parsed.basic_markplan),
      average_my_marks: asNumber(parsed.average_my_marks),
      average_markplan: asNumber(parsed.average_markplan),
      higher_my_marks: asNumber(parsed.higher_my_marks),
      higher_markplan: asNumber(parsed.higher_markplan),
      question_total_my_marks: asNumber(parsed.question_total_my_marks),
      question_total_markplan: asNumber(parsed.question_total_markplan),
    });
  } catch {
    return { ...EMPTY_BMCR_MARKS };
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
  if (!hasBmcrData(marks)) return "";
  return `BMCR ${formatPct(computeBmcrPct(marks))} · Basic marks ${formatPct(computeBasicMarkPct(marks))} · My ${marks.question_total_my_marks} / Markplan ${marks.question_total_markplan}`;
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

export async function saveBmcrEvaluation(input: {
  studentId: string;
  assignmentId: string;
  marks: BmcrMarks;
  challenges?: string[];
  key_takeaways?: string;
  existingId?: string;
}): Promise<{ ok: boolean; error?: string; evaluation?: BmcrEvaluation }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (!input.assignmentId) return { ok: false, error: "Missing assignment id." };

  const existingRow = await fetchLessonBmcrEvaluation(input.studentId, input.assignmentId);
  const marks = withQuestionTotal(input.marks);
  const row = {
    student_id: input.studentId,
    assignment_id: input.assignmentId,
    ...marks,
    challenges: input.challenges ?? existingRow?.challenges ?? [],
    key_takeaways: (input.key_takeaways ?? existingRow?.key_takeaways ?? "").trim(),
    submitted_at: new Date().toISOString(),
  };

  const targetId = input.existingId || existingRow?.id;
  const query = targetId
    ? client.from("assignment_bmcr_evaluations").update(row).eq("id", targetId).eq("student_id", input.studentId)
    : client.from("assignment_bmcr_evaluations").upsert(row, { onConflict: "student_id,assignment_id" });

  let { data, error } = await query.select("*").maybeSingle();
  if (error && !targetId) {
    const retry = await client.from("assignment_bmcr_evaluations").insert(row).select("*").maybeSingle();
    data = retry.data;
    error = retry.error;
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
    evaluation: data ? evaluationFromRow(data as Record<string, unknown>) : evaluationFromRow({ ...row, id: targetId }),
  };
}
