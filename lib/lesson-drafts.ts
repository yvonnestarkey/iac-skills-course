import { isCoachAccount } from "@/lib/roles";
import { staffOverrideApplies, type StaffCourseView } from "@/lib/staff-access";
import type { OutlineChapter } from "@/lib/student-lesson";

export function isDraftLesson(lesson: { is_draft?: boolean | null } | null | undefined): boolean {
  return lesson?.is_draft === true;
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
  return chapters.map((chapter) => ({
    ...chapter,
    lessons: (chapter.lessons || []).filter((lesson) => !isDraftLesson(lesson)),
  }));
}
