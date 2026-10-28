import { isMainTaskAssignment } from "@/lib/course-phases";
import type { DrillAttempt, ReadingCheckResult } from "@/lib/reading-drills";
import { attemptForExercise, checkForId, READING_CHECK } from "@/lib/reading-drills";
import type { OutlineChapter } from "@/lib/student-lesson";
import { hasSubmissionContent } from "@/lib/task1-gate";

/** Fallback when the live outline has not loaded yet. Matches Task 2 Question & Submission. */
export const TASK_2_ASSIGNMENT_FALLBACK_ID = "ch12-l15";

export type Task2Assignment = {
  chapterId: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
};

function isTask2Chapter(title: string): boolean {
  const trimmed = title.trim();
  return /^Task\s+2\b/i.test(trimmed) && !/\bExtra\b/i.test(trimmed);
}

export function findTask2Assignment(outline: OutlineChapter[] | null | undefined): Task2Assignment | null {
  for (const chapter of outline || []) {
    if (!isTask2Chapter(chapter.title || "")) continue;
    const lesson = (chapter.lessons || []).find((item) => isMainTaskAssignment(chapter.title, item));
    if (lesson) {
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      };
    }
  }
  return null;
}

export function task2AssignmentFromOutline(outline?: OutlineChapter[] | null): Task2Assignment {
  return (
    findTask2Assignment(outline) || {
      chapterId: "ch12",
      chapterTitle: "Task 2 - Planning your Case Study & Required",
      lessonId: TASK_2_ASSIGNMENT_FALLBACK_ID,
      lessonTitle: "Task 2 - Question & Submission",
    }
  );
}

/**
 * The Reading & RTFQ practice hub unlocks when Task 2's assignment is submitted.
 * Course lessons in Task 2 stay on normal progression.
 */
export function hasTask2Submission(
  submissions: Record<string, { body?: string | null; link_url?: string | null } | undefined> | null | undefined,
  outline?: OutlineChapter[] | null
): boolean {
  const lessonId = task2AssignmentFromOutline(outline).lessonId;
  return hasSubmissionContent(submissions?.[lessonId]);
}

export function task2LessonHref(outline?: OutlineChapter[] | null): string {
  return `/student/${task2AssignmentFromOutline(outline).lessonId}`;
}

export const TASK2_READING_CHECK_TOOL = "reading-check";
export const TASK2_MOPANE_TOOL = "reading-drill:mopane";
export const TASK2_MOPANE_EXERCISE_ID = "mopane";

export type Task2ReadingLesson = {
  id: string;
  title: string;
  kind: "check" | "mopane";
};

export type Task2ReadingLessons = {
  check: Task2ReadingLesson | null;
  mopane: Task2ReadingLesson | null;
};

export function isTask2ReadingCheckLesson(lesson: { title?: string | null; tool?: string | null }): boolean {
  const tool = String(lesson.tool || "").trim();
  if (tool === TASK2_READING_CHECK_TOOL) return true;
  return /skimming|reading check/i.test(String(lesson.title || ""));
}

export function isTask2MopaneLesson(lesson: { title?: string | null; tool?: string | null }): boolean {
  const tool = String(lesson.tool || "").trim();
  if (tool === TASK2_MOPANE_TOOL) return true;
  return /mopane/i.test(String(lesson.title || ""));
}

export function findTask2ReadingLessons(outline: OutlineChapter[] | null | undefined): Task2ReadingLessons {
  let check: Task2ReadingLesson | null = null;
  let mopane: Task2ReadingLesson | null = null;
  for (const chapter of outline || []) {
    if (!isTask2Chapter(chapter.title || "")) continue;
    for (const lesson of chapter.lessons || []) {
      if (!check && isTask2ReadingCheckLesson(lesson)) {
        check = { id: lesson.id, title: lesson.title || "Reading check", kind: "check" };
      }
      if (!mopane && isTask2MopaneLesson(lesson)) {
        mopane = { id: lesson.id, title: lesson.title || "Mopane", kind: "mopane" };
      }
    }
  }
  return { check, mopane };
}

/** Task 2's assignment stays locked until the Skimming check and Mopane drill are done. */
export function applyTask2ReadingAssignmentPrereqs(chapters: OutlineChapter[]): OutlineChapter[] {
  const tools = findTask2ReadingLessons(chapters);
  const assignment = findTask2Assignment(chapters);
  const extra = [tools.check?.id, tools.mopane?.id].filter((id): id is string => Boolean(id));
  if (!assignment || extra.length < 2) return chapters;
  return chapters.map((chapter) => ({
    ...chapter,
    lessons: (chapter.lessons || []).map((lesson) =>
      lesson.id === assignment.lessonId ? { ...lesson, extra_prereq_lesson_ids: extra } : lesson
    ),
  }));
}

export function readingHistoryCompletion(
  outline: OutlineChapter[] | null | undefined,
  history: { attempts?: DrillAttempt[] | null; checks?: ReadingCheckResult[] | null } | null | undefined,
  completed?: Record<string, boolean> | null
): Record<string, boolean> {
  const tools = findTask2ReadingLessons(outline);
  const next: Record<string, boolean> = {};
  const checkDone = Boolean(
    (tools.check && completed?.[tools.check.id]) || checkForId(history?.checks || [], READING_CHECK.id)
  );
  const mopaneDone = Boolean(
    (tools.mopane && completed?.[tools.mopane.id]) || attemptForExercise(history?.attempts || [], TASK2_MOPANE_EXERCISE_ID)
  );
  if (checkDone && tools.check) next[tools.check.id] = true;
  if (mopaneDone && tools.mopane) next[tools.mopane.id] = true;
  return next;
}

export function mergeCompletedWithReading(
  completed: Record<string, boolean> | null | undefined,
  outline: OutlineChapter[] | null | undefined,
  history: { attempts?: DrillAttempt[] | null; checks?: ReadingCheckResult[] | null } | null | undefined
): Record<string, boolean> {
  return { ...(completed || {}), ...readingHistoryCompletion(outline, history, completed) };
}

export function task2ReadingCheckResult(
  checks: ReadingCheckResult[] | null | undefined
): ReadingCheckResult | null {
  return checkForId(checks || [], READING_CHECK.id);
}

export function task2MopaneResult(attempts: DrillAttempt[] | null | undefined): DrillAttempt | null {
  return attemptForExercise(attempts || [], TASK2_MOPANE_EXERCISE_ID);
}

export function task2ReadingCheckSummary(check: ReadingCheckResult | null): string {
  if (!check) return "Not done yet";
  return `Complete · ${check.profile} · ${check.wpm} words a minute · ${check.absorb} of ${check.absorb_n} absorbed`;
}

export function task2MopaneSummary(attempt: DrillAttempt | null): string {
  if (!attempt) return "Not done yet";
  const pct = Math.round(Number(attempt.grade?.pct || 0));
  return `Complete · ${pct}%`;
}
