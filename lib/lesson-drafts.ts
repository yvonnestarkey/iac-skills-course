import { isCoachAccount } from "@/lib/roles";
import { staffOverrideApplies, type StaffCourseView } from "@/lib/staff-access";
import type { OutlineChapter } from "@/lib/student-lesson";
import { withoutRetiredChapters } from "@/lib/study-clinic";

export const LESSON_DRAFTS_SQL_HINT =
  "Paste supabase/lesson-drafts.sql in the Supabase SQL editor, then try again. Drafts cannot save until that is in place.";

export function asDraftFlag(value: unknown): boolean {
  if (value === true || value === 1 || value === "1") return true;
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function isDraftLesson(lesson: { is_draft?: boolean | null } | null | undefined): boolean {
  return asDraftFlag(lesson?.is_draft);
}

export function canViewDraftLessons(
  user: Parameters<typeof staffOverrideApplies>[0],
  view: StaffCourseView = "override",
  previewUnlocked = false
): boolean {
  return staffOverrideApplies(user, view) || (previewUnlocked && isCoachAccount(user));
}

/** Drop draft lessons so students never see them in the course tree. */
export function publishedOutline(chapters: OutlineChapter[]): OutlineChapter[] {
  return withoutRetiredChapters(chapters).map((chapter) => ({
    ...chapter,
    lessons: (chapter.lessons || []).filter((lesson) => !isDraftLesson(lesson)),
  }));
}
