import { isMainTaskAssignment } from "@/lib/course-phases";
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
