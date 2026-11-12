import { addDays, isoDate, mondayOf, MONTHS, parseISO } from "./dates";
import { assembleStudentProgress, emptyStudentProgress, type StudentProgressView } from "./lesson-progress";
import { portalToday } from "./student-task-due-dates";
import { getSupabase } from "./supabase";
import { hasSubmissionContent } from "./task1-gate";

export const STUDY_JOURNAL_SQL_HINT =
  "Paste supabase/student-study-journal.sql in the Supabase SQL editor, then try again.";

export const JOURNAL_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const JOURNAL_MOODS = [
  { id: "great", emoji: "😄", label: "Great" },
  { id: "good", emoji: "🙂", label: "Good" },
  { id: "okay", emoji: "😐", label: "Okay" },
  { id: "tired", emoji: "😴", label: "Tired" },
  { id: "tough", emoji: "😓", label: "Tough" },
  { id: "frustrated", emoji: "😤", label: "Frustrated" },
  { id: "overwhelmed", emoji: "😭", label: "Overwhelmed" },
  { id: "proud", emoji: "😎", label: "In the zone" },
  { id: "unsure", emoji: "🤔", label: "Unsure" },
  { id: "worried", emoji: "😬", label: "Worried" },
] as const;

export type JournalMoodId = (typeof JOURNAL_MOODS)[number]["id"];

export const JOURNAL_STUDIED = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
] as const;

export const JOURNAL_PLAN = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "no_plan", label: "Didn't have a plan" },
] as const;

export const JOURNAL_WHERE = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "not_sure", label: "Not sure" },
  { id: "sort_of", label: "Sort of" },
] as const;

export const JOURNAL_NEEDS = [
  { id: "nothing", label: "Nothing" },
  { id: "encouragement", label: "Encouragement" },
  { id: "hope", label: "Hope" },
  { id: "reality_check", label: "Reality check" },
  { id: "accountability", label: "Accountability nudge" },
  { id: "other", label: "Other" },
] as const;

export type JournalDay = {
  studied: string;
  studiedWhat: string;
  stuckToPlan: string;
  mood: string;
  note: string;
};

export type StudyJournalWeek = {
  weekStart: string;
  examOn: string | null;
  lastQuestion: string;
  questionsPerWeek: number | null;
  whereIAm: string;
  weekNeed: string;
  weekNeedOther: string;
  weekGoals: string;
  days: Record<string, JournalDay>;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDate(value: unknown): string | null {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function tableMissing(message: string): boolean {
  return /student_study_journal|does not exist|schema cache|could not find/i.test(message);
}

function journalError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return STUDY_JOURNAL_SQL_HINT;
  }
  return message || "Could not save your study journal.";
}

export function emptyJournalDay(): JournalDay {
  return { studied: "", studiedWhat: "", stuckToPlan: "", mood: "", note: "" };
}

export function journalWeekStart(today = portalToday()): string {
  return isoDate(mondayOf(parseISO(today)));
}

export function journalWeekDates(weekStart: string): string[] {
  const monday = parseISO(weekStart);
  return JOURNAL_WEEKDAYS.map((_, index) => isoDate(addDays(monday, index)));
}

export function shiftJournalWeek(weekStart: string, weeks: number): string {
  return isoDate(addDays(parseISO(weekStart), weeks * 7));
}

export function journalWeekLabel(weekStart: string): string {
  const dates = journalWeekDates(weekStart);
  const first = parseISO(dates[0] || weekStart);
  const last = parseISO(dates[6] || weekStart);
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) return `${first.getDate()}–${last.getDate()} ${MONTHS[first.getMonth()]}`;
  return `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]}`;
}

export function daysUntilExam(examOn: string | null | undefined, today = portalToday()): number | null {
  const exam = asDate(examOn);
  if (!exam) return null;
  return Math.round((parseISO(exam).getTime() - parseISO(today).getTime()) / 86400000);
}

export function questionsByExamDate(
  perWeek: number | null | undefined,
  examOn: string | null | undefined,
  today = portalToday()
): number | null {
  if (perWeek == null || perWeek < 0) return null;
  const days = daysUntilExam(examOn, today);
  if (days === null) return null;
  if (days < 0) return 0;
  return Math.round(perWeek * (days / 7));
}

export function journalMood(id: string | null | undefined): (typeof JOURNAL_MOODS)[number] | null {
  return JOURNAL_MOODS.find((mood) => mood.id === id) || null;
}

export function emptyJournalWeek(weekStart: string, extras: Partial<StudyJournalWeek> = {}): StudyJournalWeek {
  const days: Record<string, JournalDay> = {};
  journalWeekDates(weekStart).forEach((date) => {
    days[date] = emptyJournalDay();
  });
  return {
    weekStart,
    examOn: extras.examOn || null,
    lastQuestion: extras.lastQuestion || "",
    questionsPerWeek: extras.questionsPerWeek ?? null,
    whereIAm: extras.whereIAm || "",
    weekNeed: extras.weekNeed || "",
    weekNeedOther: extras.weekNeedOther || "",
    weekGoals: extras.weekGoals || "",
    days: { ...days, ...(extras.days || {}) },
  };
}

export function dayFromUnknown(value: unknown): JournalDay {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    studied: asText(row.studied),
    studiedWhat: asText(row.studiedWhat),
    stuckToPlan: asText(row.stuckToPlan),
    mood: asText(row.mood),
    note: asText(row.note),
  };
}

export function weekFromRow(row: Record<string, unknown>, fallbackWeek = journalWeekStart()): StudyJournalWeek {
  const weekStart = asDate(row.week_start) || fallbackWeek;
  const rawDays = row.days && typeof row.days === "object" && !Array.isArray(row.days) ? (row.days as Record<string, unknown>) : {};
  const days: Record<string, JournalDay> = {};
  journalWeekDates(weekStart).forEach((date) => {
    days[date] = dayFromUnknown(rawDays[date]);
  });
  return {
    weekStart,
    examOn: asDate(row.exam_on),
    lastQuestion: asText(row.last_question),
    questionsPerWeek: asInt(row.questions_per_week),
    whereIAm: asText(row.where_i_am),
    weekNeed: asText(row.week_need),
    weekNeedOther: asText(row.week_need_other),
    weekGoals: asText(row.week_goals),
    days,
  };
}

export function weekWriteRow(week: StudyJournalWeek): Record<string, unknown> {
  const days: Record<string, JournalDay> = {};
  journalWeekDates(week.weekStart).forEach((date) => {
    days[date] = { ...emptyJournalDay(), ...(week.days[date] || {}) };
  });
  return {
    week_start: week.weekStart,
    exam_on: week.examOn || null,
    last_question: week.lastQuestion.trim(),
    questions_per_week: week.questionsPerWeek,
    where_i_am: week.whereIAm,
    week_need: week.weekNeed,
    week_need_other: week.weekNeedOther.trim(),
    week_goals: week.weekGoals.trim(),
    days,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchStudyJournalWeek(
  userId: string,
  weekStart: string
): Promise<{ ok: boolean; error?: string; week: StudyJournalWeek }> {
  const empty = emptyJournalWeek(weekStart);
  const client = getSupabase();
  if (!client) return { ok: true, week: empty };
  const { data, error } = await client
    .from("student_study_journal")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) return { ok: false, error: journalError(error.message), week: empty };
  if (data) return { ok: true, week: weekFromRow(data as Record<string, unknown>, weekStart) };
  const previous = await client
    .from("student_study_journal")
    .select("exam_on, last_question, questions_per_week")
    .eq("user_id", userId)
    .lt("week_start", weekStart)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (previous.data || {}) as Record<string, unknown>;
  return {
    ok: true,
    week: emptyJournalWeek(weekStart, {
      examOn: asDate(prior.exam_on),
      lastQuestion: asText(prior.last_question),
      questionsPerWeek: asInt(prior.questions_per_week),
    }),
  };
}

export async function saveStudyJournalWeek(
  userId: string,
  week: StudyJournalWeek
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: true };
  const row = { user_id: userId, ...weekWriteRow(week) };
  const { error } = await client.from("student_study_journal").upsert(row, { onConflict: "user_id,week_start" });
  if (error) return { ok: false, error: journalError(error.message) };
  return { ok: true };
}

export async function fetchOwnStudentProgress(userId: string): Promise<StudentProgressView> {
  const client = getSupabase();
  if (!client) return emptyStudentProgress();
  const progress = await client
    .from("lesson_progress")
    .select("user_id, lesson_id, completed, opened_at, last_opened_at, video_seconds, video_percent, notes, updated_at")
    .eq("user_id", userId);
  const rows = progress.error
    ? ((await client.from("lesson_progress").select("user_id, lesson_id, completed, notes, updated_at").eq("user_id", userId)).data || [])
    : progress.data || [];
  const submissions = await client.from("student_submissions").select("student_id, lesson_id").eq("student_id", userId);
  const assembled = assembleStudentProgress({
    lessonIds: [],
    progress: rows,
    submissions: submissions.data || [],
  });
  return assembled.byUser[userId] || emptyStudentProgress();
}

export function submittedTaskCount(
  items: Array<{ chapterId: string | null; assignmentLessonId: string | null }>,
  submissions: Record<string, { body?: string | null; link_url?: string | null } | undefined>
): { done: number; total: number } {
  const live = items.filter((item) => item.chapterId);
  const done = live.filter((item) => hasSubmissionContent(item.assignmentLessonId ? submissions[item.assignmentLessonId] : null)).length;
  return { done, total: live.length };
}
