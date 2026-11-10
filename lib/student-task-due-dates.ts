import { lessonMinutes } from "./lesson-duration";
import type { OutlineChapter } from "./student-lesson";
import { getSupabase } from "./supabase";

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
};

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

export function taskDueItemsFromOutline(chapters: OutlineChapter[] | null | undefined): TaskDueItem[] {
  const list = chapters || [];
  return TASK_DUE_DEFINITIONS.map((definition) => {
    const matched = list.filter((chapter) => definition.match(chapter.title || ""));
    const minutes = matched.reduce((sum, chapter) => sum + chapterMinutes(chapter), 0);
    const first = matched[0];
    return {
      id: definition.id,
      label: definition.label,
      minutes,
      approx: formatApproxDuration(minutes),
      chapterId: first?.id || null,
      firstLessonId: first?.lessons?.[0]?.id || null,
    };
  });
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

export async function saveStudentTaskDueDate(
  studentId: string,
  taskId: string,
  dueOn: string | null
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("student_task_due_dates").upsert(
    {
      student_id: studentId,
      task_id: taskId,
      due_on: dueOn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,task_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
