import { isDiyLesson, isNumberedTaskChapter } from "./course-phases";
import { addDays, isoDate, isoToSastDateAndTime, parseISO } from "./dates";
import { lessonMinutes } from "./lesson-duration";
import type { OutlineChapter, OutlineLesson } from "./student-lesson";
import { getSupabase } from "./supabase";
import { hasSubmissionContent } from "./task1-gate";

export type TaskDueItemId =
  | "task-1"
  | "task-2"
  | "task-3"
  | "task-3-diy"
  | "task-4"
  | "task-5"
  | "task-5-extra"
  | "task-6"
  | "sim-exam";

export type TaskDueDefinition = {
  id: TaskDueItemId;
  label: string;
  match: (title: string) => boolean;
};

export type TaskDueItem = {
  id: TaskDueItemId;
  label: string;
  minutes: number;
  approx: string;
  chapterId: string | null;
  firstLessonId: string | null;
  assignmentLessonId: string | null;
};

export const TASK_DUE_CADENCE_DAYS = 5;
export const CURRENT_STUDENT_FIRST_DUE_DAYS = 3;

export type TaskDueDateRow = {
  taskId: string;
  dueOn: string | null;
  updatedAt: string;
};

export type TaskDueDateHistoryRow = {
  id: string;
  taskId: string;
  dueOn: string | null;
  previousDueOn: string | null;
  changedAt: string;
};

const TITLE = (title: string) => String(title || "").trim();

export const TASK_DUE_DEFINITIONS: TaskDueDefinition[] = [
  {
    id: "task-1",
    label: "Task 1",
    match: (title) => /^Task\s+1\b/i.test(TITLE(title)) && !/\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-2",
    label: "Task 2",
    match: (title) => /^Task\s+2\b/i.test(TITLE(title)) && !/\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-3",
    label: "Task 3",
    match: (title) => /^Task\s+3\b/i.test(TITLE(title)) && !/\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-3-diy",
    label: "Task 3DIY",
    match: (title) => /^Task\s+3\b/i.test(TITLE(title)) && /\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-4",
    label: "Task 4",
    match: (title) => /^Task\s+4\b/i.test(TITLE(title)) && !/\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-5",
    label: "Task 5",
    match: (title) => /^Task\s+5\b/i.test(TITLE(title)) && !/\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-5-extra",
    label: "Task 5Extra",
    match: (title) => /^Task\s+5\b/i.test(TITLE(title)) && /\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "task-6",
    label: "Task 6",
    match: (title) => /^Task\s+6\b/i.test(TITLE(title)) && !/\b(Extra|DIY)\b/i.test(TITLE(title)),
  },
  {
    id: "sim-exam",
    label: "Sim Exam",
    match: (title) => /sim\s*exam/i.test(TITLE(title)),
  },
];

export function formatApproxDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (!total) return "Approx —";
  if (total < 45) return `Approx ${total} min`;
  const rounded = Math.round((total / 60) * 2) / 2;
  if (rounded < 1) return `Approx ${total} min`;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `Approx ${text} ${rounded === 1 ? "hour" : "hours"}`;
}

export function chapterMinutes(chapter: OutlineChapter | null | undefined): number {
  return (chapter?.lessons || []).reduce((sum, lesson) => sum + lessonMinutes(lesson), 0);
}

export function findTaskSubmitLesson(chapter: OutlineChapter | null | undefined): OutlineLesson | null {
  if (!chapter) return null;
  const allowDiy = !isNumberedTaskChapter(chapter.title || "");
  const eligible = (chapter.lessons || []).filter((lesson) => {
    if (!allowDiy && isDiyLesson(lesson.title || "")) return false;
    if (lesson.type === "assignment" || lesson.requires_submission) return true;
    return lesson.type === "upload" && /submission/i.test(lesson.title || "");
  });
  return eligible.find((lesson) => /submission|question/i.test(lesson.title || "")) || eligible[0] || null;
}

export function taskDueItemsFromOutline(chapters: OutlineChapter[] | null | undefined): TaskDueItem[] {
  const list = chapters || [];
  return TASK_DUE_DEFINITIONS.map((definition) => {
    const matched = list.filter((chapter) => definition.match(chapter.title || ""));
    const minutes = matched.reduce((sum, chapter) => sum + chapterMinutes(chapter), 0);
    const first = matched[0];
    const assignment = matched.map(findTaskSubmitLesson).find(Boolean) || null;
    return {
      id: definition.id,
      label: definition.label,
      minutes,
      approx: formatApproxDuration(minutes),
      chapterId: first?.id || null,
      firstLessonId: first?.lessons?.[0]?.id || null,
      assignmentLessonId: assignment?.id || null,
    };
  });
}

type TaskSubmissionStamp = {
  body?: string | null;
  link_url?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
};

export function isTaskSubmitted(
  item: Pick<TaskDueItem, "assignmentLessonId">,
  submissions: Record<string, TaskSubmissionStamp | undefined> | null | undefined
): boolean {
  return Boolean(item.assignmentLessonId && hasSubmissionContent(submissions?.[item.assignmentLessonId]));
}

/** SAST calendar date of the Task assignment submission, or null if it has not been submitted. */
export function taskSubmittedOn(
  item: Pick<TaskDueItem, "assignmentLessonId">,
  submissions: Record<string, TaskSubmissionStamp | undefined> | null | undefined
): string | null {
  if (!isTaskSubmitted(item, submissions) || !item.assignmentLessonId) return null;
  const row = submissions?.[item.assignmentLessonId];
  return isoToSastDateAndTime(row?.submitted_at || row?.updated_at || "").date || null;
}

export function taskDateToShow(
  item: Pick<TaskDueItem, "assignmentLessonId">,
  submissions: Record<string, TaskSubmissionStamp | undefined> | null | undefined,
  plannedDueOn?: string | null
): { date: string | null; kind: "submitted" | "due" } {
  if (isTaskSubmitted(item, submissions)) return { date: taskSubmittedOn(item, submissions), kind: "submitted" };
  return { date: plannedDueOn || null, kind: "due" };
}

export function portalToday(now: Date = new Date()): string {
  return isoToSastDateAndTime(now).date;
}

export function addCalendarDays(iso: string, days: number): string {
  return isoDate(addDays(parseISO(iso), days));
}

export function suggestedTaskDueDates(input: {
  today: string;
  registeredOn: string;
  items: Array<{ id: string; completed?: boolean }>;
}): Record<string, string> {
  const today = String(input.today || "").slice(0, 10);
  const registeredOn = String(input.registeredOn || today).slice(0, 10);
  const dates: Record<string, string> = {};
  if (!today || !registeredOn) return dates;

  const currentStudent = registeredOn < today;
  if (currentStudent) {
    let remaining = 0;
    input.items.forEach((item) => {
      if (item.completed) return;
      dates[item.id] = addCalendarDays(today, CURRENT_STUDENT_FIRST_DUE_DAYS + remaining * TASK_DUE_CADENCE_DAYS);
      remaining += 1;
    });
    return dates;
  }

  input.items.forEach((item, index) => {
    dates[item.id] = addCalendarDays(registeredOn, (index + 1) * TASK_DUE_CADENCE_DAYS);
  });
  return dates;
}

function asDate(value: unknown): string | null {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

export async function fetchStudentTaskDueDates(studentId: string): Promise<{
  ok: boolean;
  error?: string;
  dates: Record<string, TaskDueDateRow>;
  history: TaskDueDateHistoryRow[];
}> {
  const client = getSupabase();
  if (!client) return { ok: true, dates: {}, history: [] };

  const [current, history] = await Promise.all([
    client.from("student_task_due_dates").select("task_id, due_on, updated_at").eq("student_id", studentId),
    client
      .from("student_task_due_date_history")
      .select("id, task_id, due_on, previous_due_on, changed_at")
      .eq("student_id", studentId)
      .order("changed_at", { ascending: false }),
  ]);

  if (current.error) return { ok: false, error: current.error.message, dates: {}, history: [] };
  if (history.error) return { ok: false, error: history.error.message, dates: {}, history: [] };

  const dates: Record<string, TaskDueDateRow> = {};
  (current.data || []).forEach((row) => {
    const taskId = String(row.task_id || "");
    if (!taskId) return;
    dates[taskId] = {
      taskId,
      dueOn: asDate(row.due_on),
      updatedAt: String(row.updated_at || ""),
    };
  });

  return {
    ok: true,
    dates,
    history: (history.data || []).map((row) => ({
      id: String(row.id),
      taskId: String(row.task_id || ""),
      dueOn: asDate(row.due_on),
      previousDueOn: asDate(row.previous_due_on),
      changedAt: String(row.changed_at || ""),
    })),
  };
}

export async function fetchStudentRegisteredOn(studentId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  const profile = await client.from("profiles").select("created_at").eq("id", studentId).maybeSingle();
  const fromProfile = isoToSastDateAndTime(String(profile.data?.created_at || "")).date;
  if (fromProfile) return fromProfile;
  const auth = await client.auth.getUser();
  return isoToSastDateAndTime(auth.data.user?.created_at || "").date || null;
}

export async function saveStudentTaskDueDate(
  studentId: string,
  taskId: string,
  dueOn: string | null
): Promise<{ ok: boolean; error?: string }> {
  return saveStudentTaskDueDates(studentId, [{ taskId, dueOn }]);
}

export async function saveStudentTaskDueDates(
  studentId: string,
  rows: Array<{ taskId: string; dueOn: string | null }>
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (!rows.length) return { ok: true };
  const { error } = await client.from("student_task_due_dates").upsert(
    rows.map((row) => ({
      student_id: studentId,
      task_id: row.taskId,
      due_on: row.dueOn,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "student_id,task_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
