import { isMainTaskAssignment } from "@/lib/course-phases";
import type { OutlineChapter, OutlineLesson } from "@/lib/student-lesson";

/** Fallback when the live outline has not loaded yet. Matches the Task 1 assignment in the course seed. */
export const TASK_1_ASSIGNMENT_FALLBACK_ID = "ch10-l7";

export type Task1Assignment = {
  chapterId: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
};

function isTask1Chapter(title: string): boolean {
  const trimmed = title.trim();
  return /^Task\s+1\b/i.test(trimmed) && !/\bExtra\b/i.test(trimmed);
}

export function findTask1Assignment(outline: OutlineChapter[] | null | undefined): Task1Assignment | null {
  for (const chapter of outline || []) {
    if (!isTask1Chapter(chapter.title || "")) continue;
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

export function task1AssignmentLessonId(outline?: OutlineChapter[] | null): string {
  return findTask1Assignment(outline)?.lessonId || TASK_1_ASSIGNMENT_FALLBACK_ID;
}

export function task1AssignmentFromOutline(outline?: OutlineChapter[] | null): Task1Assignment {
  return (
    findTask1Assignment(outline) || {
      chapterId: "ch10",
      chapterTitle: "Task 1 - How to evaluate whether you need revision",
      lessonId: TASK_1_ASSIGNMENT_FALLBACK_ID,
      lessonTitle: "Task 1 - Question & Submission",
    }
  );
}

export function hasSubmissionContent(submission: { body?: string | null; link_url?: string | null } | null | undefined): boolean {
  if (!submission) return false;
  return Boolean(String(submission.body || "").trim() || String(submission.link_url || "").trim());
}

/**
 * Script Evaluator unlocks when the real Task 1 assignment has a submission
 * (`student_submissions` for `ch10-l7` / the live Task 1 assignment lesson).
 * BMCR / Volume / Buried Treasure are not prerequisites.
 */
export function hasTask1Submission(
  submissions: Record<string, { body?: string | null; link_url?: string | null } | undefined> | null | undefined,
  outline?: OutlineChapter[] | null
): boolean {
  const lessonId = task1AssignmentFromOutline(outline).lessonId;
  return hasSubmissionContent(submissions?.[lessonId]);
}

export function task1LessonHref(outline?: OutlineChapter[] | null): string {
  return `/student/${task1AssignmentFromOutline(outline).lessonId}`;
}

export function isTask1AssignmentLesson(lesson: OutlineLesson | { id: string }, outline?: OutlineChapter[] | null): boolean {
  return lesson.id === task1AssignmentFromOutline(outline).lessonId;
}
