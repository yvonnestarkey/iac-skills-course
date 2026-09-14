import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { AccessResult } from "./accessControl";
import { displayLessonType } from "./lesson-type";
import { getLessonPdfUrl } from "./getLessonPdf";
import { fetchCourseOutline, fetchStudentLesson, type StudentLesson } from "./student-lesson";
import type { SubmissionStatus } from "./student-submissions";
import type { LessonType } from "../types/database";

export interface LessonData {
  lesson: StudentLesson | null;
  pdfUrl: string | undefined;
  lessonType: LessonType | undefined;
  isLocked: boolean;
  submissionStatus: SubmissionStatus | null;
  access: AccessResult;
}

const loadCachedOutline = cache(
  unstable_cache(fetchCourseOutline, ["course-outline-v1"], {
    revalidate: 120,
    tags: ["course-outline"],
  })
);

const loadCachedLesson = cache(async (lessonId: string) => {
  return unstable_cache(
    async () => {
      const outline = await loadCachedOutline();
      return fetchStudentLesson(lessonId, outline);
    },
    ["student-lesson-v1", lessonId],
    { revalidate: 60, tags: ["lessons", `lesson-${lessonId}`] }
  )();
});

/**
 * Single lesson loader for `/student/[lessonId]` and `/coach/preview/[lessonId]`.
 * Access gates stay on the client session so this payload can be cached.
 * Coach preview still passes `overrideLocks: true` for the lock overlay.
 */
export const getLessonData = cache(async (
  lessonId: string,
  _options?: { studentId?: string | null; overrideLocks?: boolean }
): Promise<LessonData> => {
  const lesson = await loadCachedLesson(lessonId);
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

  return {
    lesson: normalized,
    pdfUrl,
    lessonType,
    isLocked: false,
    submissionStatus: null,
    access: { isLocked: false },
  };
});
