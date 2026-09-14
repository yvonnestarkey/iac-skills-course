import { catalogFromOutline, checkLessonAccess, outlineToGate, type AccessResult } from "./accessControl";
import { displayLessonType } from "./lesson-type";
import { getLessonPdfUrl } from "./getLessonPdf";
import {
  fetchCompletedLessonIds,
  fetchCourseOutline,
  fetchStudentLesson,
  type StudentLesson,
} from "./student-lesson";
import { fetchStudentSubmissions, type SubmissionStatus } from "./student-submissions";
import type { LessonType } from "../types/database";

export interface LessonData {
  lesson: StudentLesson | null;
  pdfUrl: string | undefined;
  lessonType: LessonType | undefined;
  isLocked: boolean;
  submissionStatus: SubmissionStatus | null;
  access: AccessResult;
}

/**
 * Single lesson loader for `/student/[lessonId]` and `/coach/preview/[lessonId]`.
 * Coach preview passes `overrideLocks: true` so only the lock overlay is skipped.
 */
export async function getLessonData(
  lessonId: string,
  options?: { studentId?: string | null; overrideLocks?: boolean }
): Promise<LessonData> {
  const lesson = await fetchStudentLesson(lessonId);
  if (!lesson) {
    return {
      lesson: null,
      pdfUrl: undefined,
      lessonType: undefined,
      isLocked: false,
      submissionStatus: null,
      access: { isLocked: false },
    };
  }

  const pdfUrl = getLessonPdfUrl(lesson) || lesson.pdf_url;
  const lessonType = displayLessonType({ ...lesson, pdf_url: pdfUrl });
  const normalized: StudentLesson = { ...lesson, pdf_url: pdfUrl, type: lessonType };

  let submissionStatus: SubmissionStatus | null = null;
  let access: AccessResult = { isLocked: false };

  if (options?.studentId) {
    const [submissions, completedIds, outline] = await Promise.all([
      fetchStudentSubmissions(options.studentId),
      fetchCompletedLessonIds(options.studentId),
      fetchCourseOutline(),
    ]);
    submissionStatus = submissions[normalized.id]?.status ?? null;
    const catalog = catalogFromOutline(outline);
    const target = catalog.find((item) => item.id === normalized.id) || outlineToGate(normalized);
    const completed: Record<string, boolean> = {};
    completedIds.forEach((id) => {
      completed[id] = true;
    });
    access = checkLessonAccess(target, catalog, submissions, { completed });
  }

  if (options?.overrideLocks) {
    access = { isLocked: false, reason: access.reason, prereqLessonId: access.prereqLessonId, prereqTitle: access.prereqTitle };
  }

  return {
    lesson: normalized,
    pdfUrl,
    lessonType,
    isLocked: access.isLocked,
    submissionStatus,
    access,
  };
}
