import { addDays, isoDate, isoToSastDateAndTime, mondayOf, MONTHS, parseISO } from "./dates";
import { assembleStudentProgress, emptyStudentProgress, type StudentProgressView } from "./lesson-progress";
import { portalToday } from "./student-task-due-dates";
import { unpackSubmissionContent } from "./student-submissions";
import { getSupabase } from "./supabase";
import { hasSubmissionContent } from "./task1-gate";

export const STUDY_JOURNAL_SQL_HINT =
  "Paste supabase/student-study-journal.sql in the Supabase SQL editor, then try again.";

export const JOURNAL_EXAM_ON = "2027-01-26";
export const JOURNAL_EXAM_LABEL = "26 January 2027";

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
  { id: "task", label: "Worked on Task" },
  { id: "revision", label: "Revision" },
  { id: "question", label: "Question" },
  { id: "class", label: "Class" },
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
  questionsDone: number | null;
  stuckToPlan: string;
  mood: string;
  note: string;
};

export type JournalQuestionStats = {
  lastQuestion: string;
  lastQuestionOn: string | null;
  questionsDone: number;
  estimatedByExam: number | null;
};

export type JournalCourseDay = {
  loggedIn: boolean;
  completed: number;
  submitted: string[];
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

export type JournalPrivacy = {
  private: boolean;
  promptSeen: boolean;
};

export function emptyJournalPrivacy(): JournalPrivacy {
  return { private: false, promptSeen: false };
}

export function journalChoiceLabel(options: ReadonlyArray<{ id: string; label: string }>, id: string): string {
  return options.find((option) => option.id === id)?.label || "";
}

export function journalDayFilled(day: JournalDay | undefined): boolean {
  if (!day) return false;
  return Boolean(day.studied || day.studiedWhat || day.questionsDone || day.stuckToPlan || day.mood || day.note);
}

export function journalWeekFilled(week: StudyJournalWeek): boolean {
  return Boolean(
    week.weekGoals ||
      week.lastQuestion ||
      week.questionsPerWeek != null ||
      week.whereIAm ||
      week.weekNeed ||
      week.weekNeedOther ||
      Object.values(week.days).some(journalDayFilled)
  );
}

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
  return /student_study_journal_settings|student_study_journal|does not exist|schema cache|could not find/i.test(message);
}

function journalError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return STUDY_JOURNAL_SQL_HINT;
  }
  return message || "Could not save your study journal.";
}

export function emptyJournalDay(): JournalDay {
  return { studied: "", studiedWhat: "", questionsDone: null, stuckToPlan: "", mood: "", note: "" };
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

export function questionsDoneOnDay(day: JournalDay | undefined): number {
  if (!day) return 0;
  if (day.questionsDone != null && day.questionsDone > 0) return day.questionsDone;
  if (day.studied === "question" || day.studiedWhat) return 1;
  return 0;
}

export function emptyJournalCourseDay(): JournalCourseDay {
  return { loggedIn: false, completed: 0, submitted: [] };
}

export function journalCourseDayLabel(day: JournalCourseDay | undefined): string {
  if (!day || (!day.loggedIn && !day.completed && !day.submitted.length)) return "No login";
  const parts: string[] = [];
  if (day.submitted.length) {
    const unique = [...new Set(day.submitted)];
    parts.push(unique.length === 1 ? `Submitted ${unique[0]}` : `Submitted ${unique.join(", ")}`);
  }
  if (day.completed > 0) {
    parts.push(`Completed ${day.completed} lesson${day.completed === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "No login";
}

function sastDateOf(value: unknown): string {
  return isoToSastDateAndTime(typeof value === "string" ? value : null).date;
}

export function courseActivityByDate(
  progress: Array<{
    lesson_id?: string | null;
    completed?: boolean | null;
    opened_at?: string | null;
    last_opened_at?: string | null;
    updated_at?: string | null;
  }>,
  submissions: Array<{
    lesson_id?: string | null;
    submitted_at?: string | null;
    updated_at?: string | null;
    body?: string | null;
    link_url?: string | null;
    content?: string | null;
  }>,
  tasks: Array<{ label: string; assignmentLessonId: string | null }>
): Record<string, JournalCourseDay> {
  const byDate: Record<string, JournalCourseDay> = {};
  const ensure = (date: string) => {
    if (!date) return null;
    if (!byDate[date]) byDate[date] = emptyJournalCourseDay();
    return byDate[date];
  };
  progress.forEach((row) => {
    const login = sastDateOf(row.last_opened_at) || sastDateOf(row.opened_at) || sastDateOf(row.updated_at);
    const bucket = ensure(login);
    if (bucket) bucket.loggedIn = true;
    if (!row.completed) return;
    const done = ensure(sastDateOf(row.updated_at) || sastDateOf(row.last_opened_at) || login);
    if (!done) return;
    done.loggedIn = true;
    done.completed += 1;
  });
  const taskByLesson = new Map(
    tasks.filter((task) => task.assignmentLessonId).map((task) => [task.assignmentLessonId as string, task.label])
  );
  submissions.forEach((row) => {
    const unpacked = unpackSubmissionContent(row);
    if (!hasSubmissionContent(unpacked)) return;
    const bucket = ensure(sastDateOf(row.submitted_at) || sastDateOf(unpacked.updated_at) || sastDateOf(row.updated_at));
    if (!bucket) return;
    bucket.loggedIn = true;
    const label = taskByLesson.get(String(row.lesson_id || "")) || "Task";
    if (!bucket.submitted.includes(label)) bucket.submitted.push(label);
  });
  return byDate;
}

export function questionStatsFromWeeks(
  weeks: StudyJournalWeek[],
  today = portalToday(),
  examOn = JOURNAL_EXAM_ON
): JournalQuestionStats {
  const entries: Array<{ date: string; question: string; count: number }> = [];
  weeks.forEach((week) => {
    Object.entries(week.days || {}).forEach(([date, day]) => {
      const count = questionsDoneOnDay(day);
      if (!count && !day?.studiedWhat) return;
      entries.push({ date, question: asText(day?.studiedWhat), count });
    });
  });
  entries.sort((left, right) => left.date.localeCompare(right.date));
  const questionsDone = entries.reduce((sum, entry) => sum + entry.count, 0);
  const last = [...entries].reverse().find((entry) => entry.question || entry.count) || null;
  const first = entries[0];
  const remaining = daysUntilExam(examOn, today);
  let estimatedByExam: number | null = null;
  if (questionsDone > 0 && first && remaining !== null) {
    const elapsed = Math.max(1, Math.round((parseISO(today).getTime() - parseISO(first.date).getTime()) / 86400000) + 1);
    const remainingDays = Math.max(0, remaining);
    estimatedByExam = remaining < 0 ? questionsDone : Math.round(questionsDone + (questionsDone / elapsed) * remainingDays);
  }
  return {
    lastQuestion: last?.question || "",
    lastQuestionOn: last?.date || null,
    questionsDone,
    estimatedByExam,
  };
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
    examOn: extras.examOn || JOURNAL_EXAM_ON,
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
    studied: asText(row.studied) === "yes" ? "task" : asText(row.studied),
    studiedWhat: asText(row.studiedWhat),
    questionsDone: asInt(row.questionsDone),
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
    examOn: JOURNAL_EXAM_ON,
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
    exam_on: JOURNAL_EXAM_ON,
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
  return { ok: true, week: emptyJournalWeek(weekStart) };
}

export async function fetchStudyJournalWeeks(
  userId: string
): Promise<{ ok: boolean; error?: string; weeks: StudyJournalWeek[] }> {
  const client = getSupabase();
  if (!client) return { ok: true, weeks: [] };
  const { data, error } = await client
    .from("student_study_journal")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: true });
  if (error) return { ok: false, error: journalError(error.message), weeks: [] };
  return {
    ok: true,
    weeks: (data || []).map((row) => weekFromRow(row as Record<string, unknown>)),
  };
}

export async function saveStudyJournalWeek(
  userId: string,
  week: StudyJournalWeek
): Promise<{ ok: true; privacy: JournalPrivacy } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: true, privacy: emptyJournalPrivacy() };
  const row = { user_id: userId, ...weekWriteRow(week) };
  const { error } = await client.from("student_study_journal").upsert(row, { onConflict: "user_id,week_start" });
  if (error) return { ok: false, error: journalError(error.message) };
  const { recordJournalNeedChange } = await import("./journal-needs");
  await recordJournalNeedChange(userId, week.weekStart, week.weekNeed, week.weekNeedOther);
  const privacy = await markJournalPromptSeen(userId);
  return { ok: true, privacy };
}

export async function fetchJournalPrivacy(userId: string): Promise<{ ok: boolean; error?: string; privacy: JournalPrivacy }> {
  const privacy = emptyJournalPrivacy();
  const client = getSupabase();
  if (!client) return { ok: true, privacy };
  const { data, error } = await client
    .from("student_study_journal_settings")
    .select("private, prompt_seen")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: journalError(error.message), privacy };
  if (!data) return { ok: true, privacy };
  const row = data as { private?: boolean; prompt_seen?: boolean };
  return { ok: true, privacy: { private: Boolean(row.private), promptSeen: Boolean(row.prompt_seen) } };
}

export async function saveJournalPrivacy(
  userId: string,
  privacy: JournalPrivacy
): Promise<{ ok: true; privacy: JournalPrivacy } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: true, privacy };
  const { error } = await client.from("student_study_journal_settings").upsert({
    user_id: userId,
    private: privacy.private,
    prompt_seen: privacy.promptSeen,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: journalError(error.message) };
  return { ok: true, privacy };
}

export async function markJournalPromptSeen(userId: string): Promise<JournalPrivacy> {
  const current = await fetchJournalPrivacy(userId);
  if (current.privacy.promptSeen) return current.privacy;
  const saved = await saveJournalPrivacy(userId, { ...current.privacy, promptSeen: true });
  return saved.ok === false ? current.privacy : saved.privacy;
}

export async function fetchCoachStudyJournal(studentId: string): Promise<{
  ok: boolean;
  error?: string;
  hidden: boolean;
  privacy: JournalPrivacy;
  weeks: StudyJournalWeek[];
}> {
  const loaded = await fetchJournalPrivacy(studentId);
  if (loaded.privacy.private) {
    return { ok: true, hidden: true, privacy: loaded.privacy, weeks: [] };
  }
  const client = getSupabase();
  if (!client) return { ok: loaded.ok, error: loaded.error, hidden: false, privacy: loaded.privacy, weeks: [] };
  const { data, error } = await client
    .from("student_study_journal")
    .select("*")
    .eq("user_id", studentId)
    .order("week_start", { ascending: false });
  if (error) {
    return { ok: false, error: journalError(error.message), hidden: false, privacy: loaded.privacy, weeks: [] };
  }
  return {
    ok: true,
    hidden: false,
    privacy: loaded.privacy,
    weeks: (data || [])
      .map((row) => weekFromRow(row as Record<string, unknown>))
      .filter(journalWeekFilled),
  };
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

export async function fetchJournalCourseActivity(
  userId: string,
  tasks: Array<{ label: string; assignmentLessonId: string | null }>
): Promise<Record<string, JournalCourseDay>> {
  const client = getSupabase();
  if (!client) return {};
  const progress = await client
    .from("lesson_progress")
    .select("lesson_id, completed, opened_at, last_opened_at, updated_at")
    .eq("user_id", userId);
  const rows = progress.error
    ? ((await client.from("lesson_progress").select("lesson_id, completed, updated_at").eq("user_id", userId)).data || [])
    : progress.data || [];
  const submissions = await client
    .from("student_submissions")
    .select("lesson_id, submitted_at, updated_at, body, link_url, content")
    .eq("student_id", userId);
  return courseActivityByDate(rows || [], submissions.data || [], tasks);
}

export function submittedTaskCount(
  items: Array<{ chapterId: string | null; assignmentLessonId: string | null }>,
  submissions: Record<string, { body?: string | null; link_url?: string | null } | undefined>
): { done: number; total: number } {
  const live = items.filter((item) => item.chapterId);
  const done = live.filter((item) => hasSubmissionContent(item.assignmentLessonId ? submissions[item.assignmentLessonId] : null)).length;
  return { done, total: live.length };
}
